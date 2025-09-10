import { QueueManager } from './manager'
import { ClaudeApiClient } from '@/lib/claude/client'
import { PromptBuilder } from '@/lib/claude/prompt-builder'
import { ResponseParser } from '@/lib/claude/response-parser'
import { ClaudeUsageTracker } from '@/lib/claude/usage-tracker'
import { LineApiClient } from '@/lib/line/client'
import { MessageTemplates } from '@/lib/line/message-templates'
import { CodeQueries } from '@/lib/supabase/queries'
import { logger } from '@/lib/utils/logger'
import { QUEUE_CONFIG } from '@/lib/constants/config'
import { ConversationSessionStore } from '@/lib/conversation/session-store'
import type { CodeGenerationRequest } from '@/types/claude'

export class QueueProcessor {
  private claudeClient: ClaudeApiClient
  private lineClient: LineApiClient
  private isProcessing: boolean = false
  private currentJobs: Set<string> = new Set()

  constructor() {
    this.claudeClient = new ClaudeApiClient()
    this.lineClient = new LineApiClient()
  }

  /**
   * キュー処理の開始
   */
  async startProcessing(): Promise<{
    processed: number
    errors: number
    remaining: number
  }> {
    if (this.isProcessing) {
      logger.debug('Queue processing already in progress')
      return { processed: 0, errors: 0, remaining: 0 }
    }

    this.isProcessing = true
    let processed = 0
    let errors = 0

    try {
      logger.info('Starting queue processing')

      // 使用量制限チェック
      const usageCheck = await ClaudeUsageTracker.checkUsageLimits()
      if (!usageCheck.allowed) {
        logger.warn('Usage limits exceeded, skipping queue processing', { 
          reason: usageCheck.reason 
        })
        return { processed: 0, errors: 0, remaining: 0 }
      }

      // 処理可能なジョブを取得
      const jobs = await QueueManager.getNextJobs(QUEUE_CONFIG.BATCH_SIZE)
      
      if (jobs.length === 0) {
        logger.debug('No jobs to process')
        return { processed: 0, errors: 0, remaining: 0 }
      }

      // 並行処理制限を考慮してジョブを処理
      const concurrentJobs = Math.min(jobs.length, QUEUE_CONFIG.MAX_CONCURRENT_JOBS)
      const jobsToProcess = jobs.slice(0, concurrentJobs)

      logger.info('Processing jobs', { 
        totalJobs: jobs.length,
        processingJobs: jobsToProcess.length
      })

      // 並行処理
      const results = await Promise.allSettled(
        jobsToProcess.map(job => this.processJob(job))
      )

      // 結果を集計
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.success) {
          processed++
        } else {
          errors++
          logger.error('Job processing failed', { error: result.status === 'rejected' ? result.reason : 'Unknown error' })
        }
      }

      const remaining = jobs.length - jobsToProcess.length

      logger.info('Queue processing completed', { processed, errors, remaining })

      return { processed, errors, remaining }

    } catch (error) {
      logger.error('Queue processing error', { error })
      return { processed, errors: errors + 1, remaining: 0 }
      
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * 個別ジョブの処理（改善版）
   */
  async processJob(job: any): Promise<{ success: boolean; error?: string }> {
    const jobId = job.id
    const startTime = Date.now()

    // アトミックな重複実行防止（Setの操作をまとめる）
    const wasAlreadyProcessing = this.currentJobs.has(jobId)
    
    if (wasAlreadyProcessing) {
      logger.warn('Job already being processed', { jobId })
      return { success: false, error: 'Duplicate processing' }
    }
    
    // チェックと追加を同時に行うことで、レースコンディションを防ぐ
    this.currentJobs.add(jobId)

    try {
      logger.info('Processing job', { 
        jobId, 
        userId: job.line_user_id,
        category: job.requirements?.category,
        isConversational: !!job.requirements?.prompt
      })

      // 1. ジョブを処理中状態に更新
      await QueueManager.startProcessing(jobId)

      let prompt: string
      let codeResponse: any

      // 2. 会話型ジョブかどうかで処理を分岐
      if (job.requirements?.prompt) {
        // 会話型: すでに生成されたプロンプトを使用
        prompt = job.requirements.prompt
        
        // Claude API呼び出し
        const claudeResponse = await this.claudeClient.sendMessage([{
          role: 'user',
          content: prompt
        }], job.line_user_id)

        // レスポンス解析
        codeResponse = ResponseParser.parseCodeResponse(claudeResponse)
        
      } else {
        // 従来型: プロンプトを構築
        const request: CodeGenerationRequest = {
          userId: job.line_user_id,
          lineUserId: job.line_user_id,
          sessionId: job.session_id,
          category: job.requirements?.category,
          subcategory: job.requirements?.subcategory,
          requirements: job.requirements?.requirements || job.requirements?.details,
          userHistory: job.requirements?.userHistory
        }

        // プロンプト構築
        prompt = await PromptBuilder.buildCodeGenerationPrompt(request)

        // Claude API呼び出し
        const claudeResponse = await this.claudeClient.sendMessage([{
          role: 'user',
          content: prompt
        }], job.line_user_id)

        // レスポンス解析
        codeResponse = ResponseParser.parseCodeResponse(claudeResponse)
      }

      // 3. 品質チェック
      const qualityCheck = ResponseParser.evaluateResponseQuality(codeResponse)
      if (qualityCheck.score < 50) {
        logger.warn('Low quality response detected', {
          jobId,
          score: qualityCheck.score,
          issues: qualityCheck.issues
        })
      }

      // 4. データベースに保存（エラーハンドリング強化）
      try {
        await CodeQueries.saveGeneratedCode({
          user_id: job.line_user_id,
          session_id: typeof job.session_id === 'string' ? job.session_id : job.session_id?.toString() || `job_${jobId}`,
          requirements_summary: this.summarizeRequirements(job.requirements),
          generated_code: codeResponse.code,
          explanation: codeResponse.explanation,
          usage_steps: codeResponse.steps,
          code_category: job.requirements?.category || 'unknown',
          code_subcategory: job.requirements?.subcategory || 'unknown',
          claude_prompt: prompt.substring(0, 10000), // 文字数制限
          claude_response_metadata: {
            qualityScore: qualityCheck.score,
            processingTime: Date.now() - startTime
          }
        })
      } catch (dbError: any) {
        logger.error('Failed to save to database', { 
          jobId, 
          error: dbError instanceof Error ? dbError.message : String(dbError),
          code: dbError?.code,
          hint: dbError?.hint,
          stack: dbError instanceof Error ? dbError.stack : undefined
        })
        // DBエラーでも続行
      }

      // 5. LINEに結果を送信（文字数制限対応）
      await this.sendResultToUser(job.line_user_id, codeResponse, job.requirements?.category)

      // 6. セッションを更新（コード生成完了フラグを立てる）
      const sessionStore = ConversationSessionStore.getInstance()
      // Supabaseから最新のセッションを取得（別プロセスからでも読み込めるように）
      const existingContext = await sessionStore.getAsync(job.line_user_id)
      if (existingContext) {
        existingContext.lastGeneratedCode = true
        existingContext.lastGeneratedCategory = job.requirements?.category
        existingContext.lastGeneratedRequirements = job.requirements
        await sessionStore.setAsync(job.line_user_id, existingContext)
        logger.info('Session updated after code generation', {
          userId: job.line_user_id,
          hasLastGeneratedCode: true
        })
      } else {
        // セッションがない場合は新規作成
        await sessionStore.setAsync(job.line_user_id, {
          messages: [],
          category: job.requirements?.category,
          subcategory: job.requirements?.subcategory,
          requirements: job.requirements,
          extractedRequirements: {},
          currentStep: 4,
          readyForCode: false,
          lastGeneratedCode: true
        } as any)
        logger.info('New session created after code generation', {
          userId: job.line_user_id
        })
      }

      // 7. ジョブを完了状態に更新
      await QueueManager.completeJob(jobId)

      const processingTime = Date.now() - startTime
      logger.info('Job completed successfully', {
        jobId,
        processingTime,
        qualityScore: qualityCheck.score
      })

      return { success: true }

    } catch (error) {
      const processingTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      logger.error('Job processing failed', {
        jobId,
        error: errorMessage,
        processingTime
      })

      // エラーメッセージをユーザーに送信
      try {
        await this.lineClient.pushMessage(job.line_user_id, [
          MessageTemplates.createErrorMessage('generation')
        ] as any)
      } catch (lineError) {
        logger.error('Failed to send error message to LINE', { lineError })
      }

      // ジョブを失敗状態に更新
      await QueueManager.failJob(jobId, errorMessage)

      return { success: false, error: errorMessage }

    } finally {
      this.currentJobs.delete(jobId)
    }
  }

  /**
   * LINEへの結果送信（構造化フォーマット対応）
   */
  private async sendResultToUser(
    lineUserId: string, 
    codeResponse: any,
    category?: string
  ): Promise<void> {
    try {
      // 構造化レスポンスフォーマットを使用
      let fullResponseText = ''
      
      // カテゴリと概要
      fullResponseText = `コード生成が完了しました！【${category || '汎用'}】\n`
      if (codeResponse.summary) {
        fullResponseText += codeResponse.summary + '\n\n'
      }
      
      // 説明
      if (codeResponse.explanation) {
        fullResponseText += codeResponse.explanation + '\n\n'
      }
      
      // コード
      if (codeResponse.code) {
        fullResponseText += `コード:\n\`\`\`javascript\n${codeResponse.code}\n\`\`\`\n\n`
      }
      
      // 設定方法（手順）
      if (codeResponse.steps && codeResponse.steps.length > 0) {
        fullResponseText += `設定方法:\n`
        codeResponse.steps.forEach((step: string, index: number) => {
          fullResponseText += `${index + 1}. ${step}\n`
        })
        fullResponseText += '\n'
      }
      
      // 注意点（もしあれば）
      if (codeResponse.notes && Array.isArray(codeResponse.notes)) {
        fullResponseText += `注意点:\n`
        codeResponse.notes.forEach((note: string) => {
          fullResponseText += `• ${note}\n`
        })
      }
      
      // デフォルトの注意点を追加
      if (!codeResponse.notes || codeResponse.notes.length === 0) {
        fullResponseText += `注意点:\n`
        fullResponseText += `• 初回実行時は承認が必要です\n`
        fullResponseText += `• コードはGoogle Apps Scriptエディタに貼り付けてください\n`
        fullResponseText += `• エラーが出た場合はスクリーンショットを送信してください\n`
      }
      
      // 構造化されたメッセージを生成
      const messages = MessageTemplates.createStructuredCodeResult(fullResponseText)
      
      // メッセージを送信（最大5つまで）
      await this.lineClient.pushMessage(lineUserId, messages.slice(0, 5))
      
    } catch (error) {
      logger.error('Failed to send result to LINE', { 
        lineUserId, 
        error: error instanceof Error ? error.message : String(error)
      })
      
      // 最低限のエラーメッセージを送信
      await this.lineClient.pushMessage(lineUserId, [{
        type: 'text',
        text: 'コード生成は完了しましたが、結果の送信に失敗しました。\n\n「新しいコードを作りたい」と送信してやり直してください。'
      }])
    }
  }

  /**
   * 要件の要約生成
   */
  private summarizeRequirements(requirements: any): string {
    if (!requirements) return '要件なし'
    
    if (requirements.conversation) {
      // 会話型の場合
      return `会話型: ${requirements.extractedRequirements?.purpose || '詳細な要件収集済み'}`
    }
    
    // 従来型の場合
    const parts = []
    if (requirements.category) parts.push(`カテゴリ: ${requirements.category}`)
    if (requirements.subcategory) parts.push(`種類: ${requirements.subcategory}`)
    if (requirements.details) parts.push(`詳細: ${requirements.details.substring(0, 100)}`)
    
    return parts.join(' / ') || '要件なし'
  }
}