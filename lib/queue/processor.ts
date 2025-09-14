import { QueueManager } from './manager'
import { ClaudeApiClient } from '@/lib/claude/client'
import { PromptBuilder } from '@/lib/claude/prompt-builder'
import { ResponseParser } from '@/lib/claude/response-parser'
import { ClaudeUsageTracker } from '@/lib/claude/usage-tracker'
import { CodeValidator } from '@/lib/claude/code-validator'
import { LineApiClient } from '@/lib/line/client'
import { MessageTemplates } from '@/lib/line/message-templates'
import { MessageFormatter } from '@/lib/line/message-formatter'
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

      // 3.5. コード検証と自動修正
      const validator = new CodeValidator()
      
      // ユーザーのメッセージ履歴を取得
      const userMessages: string[] = []
      if (job.requirements?.conversation) {
        // 会話型の場合
        const sessionStore = ConversationSessionStore.getInstance()
        const context = await sessionStore.getAsync(job.line_user_id)
        if (context?.messages) {
          userMessages.push(...context.messages.filter(m => m.role === 'user').map(m => m.content))
        }
      } else if (job.requirements?.details) {
        userMessages.push(job.requirements.details)
      }

      // コードを検証
      const validation = await validator.validateCode(
        codeResponse.code,
        job.requirements,
        userMessages
      )

      logger.info('Code validation completed', {
        jobId,
        validationScore: validation.score,
        needsRevision: validation.needsRevision,
        issues: validation.issues
      })

      // 修正が必要な場合
      if (validation.needsRevision && validation.score < 70) {
        logger.info('Code needs revision, attempting automatic fix', { jobId })
        
        // 自動修正を試みる
        const revisedCode = await validator.reviseCode(
          codeResponse.code,
          validation.issues,
          job.requirements
        )
        
        // 修正後のコードを再検証
        const revalidation = await validator.validateCode(
          revisedCode,
          job.requirements,
          userMessages
        )
        
        if (revalidation.score > validation.score) {
          logger.info('Code successfully revised', {
            jobId,
            oldScore: validation.score,
            newScore: revalidation.score
          })
          codeResponse.code = revisedCode
          
          // 修正内容を説明に追加
          if (!codeResponse.notes) {
            codeResponse.notes = []
          }
          codeResponse.notes.push('✅ コードは要件に合わせて自動調整されました')
        } else {
          logger.warn('Revision did not improve code', { jobId })
          // 元のコードを使用し、警告を追加
          if (!codeResponse.notes) {
            codeResponse.notes = []
          }
          codeResponse.notes.push('⚠️ 一部要件と異なる可能性があります。動作確認後、必要に応じて修正してください')
        }
      } else if (validation.suggestions.length > 0) {
        // 提案がある場合は注意点に追加
        if (!codeResponse.notes) {
          codeResponse.notes = []
        }
        codeResponse.notes.push(...validation.suggestions.map(s => `💡 ${s}`))
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
      const messages: any[] = []
      
      // 1. 完了通知メッセージ
      messages.push({
        type: 'text',
        text: `✅ コード生成が完了しました！【${category || '汎用'}】`
      })
      
      // 2. 説明メッセージ
      if (codeResponse.summary || codeResponse.explanation) {
        const explanation = (codeResponse.summary || '') + '\n\n' + (codeResponse.explanation || '')
        const splitExplanation = MessageFormatter.splitLongMessage(explanation.trim())
        for (const chunk of splitExplanation) {
          messages.push({
            type: 'text',
            text: chunk
          })
        }
      }
      
      // 3. コード部分（フォーマット済み、分割対応）
      if (codeResponse.code) {
        const codeMessages = MessageFormatter.formatGASCode(
          codeResponse.code,
          'Google Apps Script コード'
        )
        
        // コードメッセージを追加
        for (const codeMsg of codeMessages) {
          messages.push({
            type: 'text',
            text: codeMsg
          })
        }
      }
      
      // 4. 設定方法（手順）
      if (codeResponse.steps && codeResponse.steps.length > 0) {
        let stepsText = '📝 設定方法:\n'
        codeResponse.steps.forEach((step: string, index: number) => {
          stepsText += `${index + 1}. ${step}\n`
        })
        
        // 手順が長い場合は分割
        const splitSteps = MessageFormatter.splitLongMessage(stepsText)
        for (const chunk of splitSteps) {
          messages.push({
            type: 'text',
            text: chunk
          })
        }
      }
      
      // 5. 注意点
      let notesText = '⚠️ 注意点:\n'
      if (codeResponse.notes && Array.isArray(codeResponse.notes)) {
        codeResponse.notes.forEach((note: string) => {
          notesText += `• ${note}\n`
        })
      } else {
        notesText += `• 初回実行時は承認が必要です\n`
        notesText += `• コードはGoogle Apps Scriptエディタに貼り付けてください\n`
        notesText += `• エラーが出た場合はスクリーンショットを送信してください\n`
      }
      
      messages.push({
        type: 'text',
        text: notesText
      })
      
      // 6. アクションボタン
      messages.push({
        type: 'text',
        text: '次のアクション',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' }},
            { type: 'action', action: { type: 'message', label: '📷 エラースクショ', text: 'エラーのスクショを送る' }},
            { type: 'action', action: { type: 'message', label: '🔄 新規作成', text: '新しいコードを作りたい' }}
          ]
        }
      })
      
      // メッセージを送信（5個ずつのバッチで送信）
      for (let i = 0; i < messages.length; i += 5) {
        const batch = messages.slice(i, i + 5)
        await this.lineClient.pushMessage(lineUserId, batch)
        
        // レート制限を避けるため少し待機
        if (i + 5 < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
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