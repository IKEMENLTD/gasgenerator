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
import type { QueueJob } from '@/types/database'
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

    // 重複実行防止
    if (this.currentJobs.has(jobId)) {
      logger.warn('Job already being processed', { jobId })
      return { success: false, error: 'Duplicate processing' }
    }

    this.currentJobs.add(jobId)

    try {
      logger.info('Processing job', { 
        jobId, 
        userId: job.user_id,
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
        }], job.user_id || job.line_user_id)

        // レスポンス解析
        codeResponse = ResponseParser.parseCodeResponse(claudeResponse)
        
      } else {
        // 従来型: プロンプトを構築
        const request: CodeGenerationRequest = {
          userId: job.user_id,
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
        }], job.user_id || job.line_user_id)

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
          user_id: job.user_id || job.line_user_id,
          session_id: job.session_id || `job_${jobId}`,
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
      } catch (dbError) {
        logger.error('Failed to save to database', { jobId, error: dbError })
        // DBエラーでも続行
      }

      // 5. LINEに結果を送信（文字数制限対応）
      await this.sendResultToUser(job.line_user_id, codeResponse, job.requirements?.category)

      // 6. ジョブを完了状態に更新
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
   * LINEへの結果送信（文字数制限対応）
   */
  private async sendResultToUser(
    lineUserId: string, 
    codeResponse: any,
    category?: string
  ): Promise<void> {
    try {
      const messages: any[] = []
      
      // 1. 概要メッセージ
      messages.push({
        type: 'text',
        text: `✅ コード生成が完了しました！\n\n【カテゴリ】${category || '汎用'}\n【概要】${codeResponse.summary || 'GASコードを生成しました'}`
      })

      // 2. 説明（500文字以内に制限）
      if (codeResponse.explanation) {
        const explanation = codeResponse.explanation.length > 500 
          ? codeResponse.explanation.substring(0, 497) + '...'
          : codeResponse.explanation
        
        messages.push({
          type: 'text',
          text: `【説明】\n${explanation}`
        })
      }

      // 3. コード（4000文字を超える場合は分割）
      if (codeResponse.code) {
        const code = codeResponse.code
        const MAX_CODE_LENGTH = 4000
        
        if (code.length <= MAX_CODE_LENGTH) {
          messages.push({
            type: 'text',
            text: `【コード】\n\`\`\`javascript\n${code}\n\`\`\``
          })
        } else {
          // コードが長い場合は要約版を送信
          const truncatedCode = code.substring(0, 1000)
          messages.push({
            type: 'text',
            text: `【コード（抜粋）】\n\`\`\`javascript\n${truncatedCode}\n...\n\n// コードが長いため省略されました\n// 全体は${code.length}文字です\n\`\`\``
          })
          
          // 完全版へのリンクや保存先を案内
          messages.push({
            type: 'text',
            text: '💡 完全なコードはWebサイトからダウンロードできます。\n\nアカウントページにアクセスしてください。'
          })
        }
      }

      // 4. 使用手順
      if (codeResponse.steps && codeResponse.steps.length > 0) {
        const steps = codeResponse.steps.slice(0, 5).join('\n')
        messages.push({
          type: 'text',
          text: `【使用手順】\n${steps}`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '🆕 新しいコード', text: '新しいコードを作りたい' }},
              { type: 'action', action: { type: 'message', label: '📝 修正', text: '修正したい' }}
            ]
          }
        })
      }

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