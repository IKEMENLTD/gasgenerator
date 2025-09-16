import { QueueManager } from './manager'
import { ClaudeApiClient } from '@/lib/claude/client'
import { PromptBuilder } from '@/lib/claude/prompt-builder'
import { ResponseParser } from '@/lib/claude/response-parser'
import { ClaudeUsageTracker } from '@/lib/claude/usage-tracker'
import { CodeValidator } from '@/lib/claude/code-validator'
import { LineApiClient } from '@/lib/line/client'
import { MessageTemplates } from '@/lib/line/message-templates'
// import { MessageFormatter } from '@/lib/line/message-formatter'  // 未使用（2通メッセージ化で不要になった）
import { CodeQueries } from '@/lib/supabase/queries'
import { CodeShareQueries } from '@/lib/supabase/code-share-queries'
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
        
        // Claude API呼び出し（コード生成用に最大32Kトークンを使用）
        const claudeResponse = await this.claudeClient.sendMessage([{
          role: 'user',
          content: prompt
        }], job.line_user_id, 3, 32000)

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

        // Claude API呼び出し（コード生成用に最大32Kトークンを使用）
        const claudeResponse = await this.claudeClient.sendMessage([{
          role: 'user',
          content: prompt
        }], job.line_user_id, 3, 32000)

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

      // 4.5. コード共有URLを作成
      let codeShareUrl: string | undefined
      try {
        // タイトルを生成（カテゴリと要約から）
        const title = this.generateCodeTitle(job.requirements?.category, codeResponse.summary)

        // プレミアムステータスを確認
        const isPremium = await this.checkUserPremiumStatus(job.line_user_id)

        // コード共有を作成
        const codeShare = await CodeShareQueries.create({
          userId: job.line_user_id,
          code: codeResponse.code,
          title: title,
          description: codeResponse.explanation || codeResponse.summary,
          jobId: jobId,
          sessionId: typeof job.session_id === 'string' ? job.session_id : undefined,
          requirements: job.requirements,
          conversationContext: undefined, // 後で会話コンテキストを追加可能
          expiresInDays: isPremium ? 30 : 7,
          isPremium: isPremium,
          tags: this.generateTags(job.requirements?.category, job.requirements?.subcategory)
        })

        // URLを生成
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gasgenerator.onrender.com'
        codeShareUrl = `${baseUrl}/s/${codeShare.short_id}`

        logger.info('Code share URL created', {
          jobId,
          shortId: codeShare.short_id,
          url: codeShareUrl
        })

      } catch (shareError) {
        logger.error('Failed to create code share', {
          jobId,
          error: shareError instanceof Error ? shareError.message : String(shareError)
        })
        // 共有URL作成に失敗してもジョブは継続
      }

      // 5. LINEに結果を送信（共有URL付き）
      await this.sendResultToUser(job.line_user_id, codeResponse, job.requirements?.category, codeShareUrl)

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
    category?: string,
    codeShareUrl?: string
  ): Promise<void> {
    try {
      const messages: any[] = []

      // メッセージ1: コード完成通知 + URL + 簡潔な説明
      let firstMessage = `✅ コード生成が完了しました！【${category || 'GAS'}】\n\n`

      // URL追加
      if (codeShareUrl) {
        firstMessage += `📎 コードはこちら:\n${codeShareUrl}\n\n`
      }

      // 簡潔な説明（3行以内）
      if (codeResponse.summary) {
        const summaryLines = codeResponse.summary.split('\n').slice(0, 3).join('\n')
        firstMessage += `📝 ${summaryLines}\n\n`
      }

      // 初心者向けの最重要ステップ
      firstMessage += '【設定手順】\n'
      firstMessage += '1️⃣ 上記URLをタップしてコードをコピー\n'
      firstMessage += '2️⃣ Google Apps Scriptを開く\n'
      firstMessage += '3️⃣ コードを貼り付けて保存（Ctrl+S）\n'
      firstMessage += '4️⃣ 実行ボタン▶️をクリック'

      messages.push({
        type: 'text',
        text: firstMessage
      })
      // メッセージ2: 詳細な注意点とアクションボタン
      let secondMessage = ''

      // コード直接送信が必要な場合（URLなし）
      if (codeResponse.code && !codeShareUrl) {
        secondMessage += '📋 コード:\n```\n'
        secondMessage += codeResponse.code.substring(0, 800) // 800文字まで
        if (codeResponse.code.length > 800) {
          secondMessage += '\n...(省略)...'
        }
        secondMessage += '\n```\n\n'
      }

      // 重要な注意点（初心者向け）
      secondMessage += '⚠️ よくあるつまずきポイント:\n'
      secondMessage += '• 初回実行時は「承認が必要です」と出ます→「許可」してください\n'
      secondMessage += '• トリガー設定が必要な場合は「時計マーク⏰」から設定\n'
      secondMessage += '• エラーが出たら画面スクショを送ってください、すぐ解決します！\n\n'

      // カスタム注意事項があれば追加
      if (codeResponse.notes && Array.isArray(codeResponse.notes) && codeResponse.notes.length > 0) {
        secondMessage += '💡 このコード特有の設定:\n'
        codeResponse.notes.slice(0, 2).forEach((note: string) => {
          secondMessage += `• ${note}\n`
        })
        secondMessage += '\n'
      }

      // サポート情報
      secondMessage += '困ったら遠慮なく聞いてください！'

      messages.push({
        type: 'text',
        text: secondMessage,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '✏️ 修正したい', text: '修正' }},
            { type: 'action', action: { type: 'message', label: '📷 エラー画面', text: 'エラーのスクショを送る' }},
            { type: 'action', action: { type: 'message', label: '🔄 別のコード', text: '新しいコードを作りたい' }},
            { type: 'action', action: { type: 'message', label: '❓ 使い方', text: '使い方を教えて' }}
          ]
        }
      })
      
      // 2通のメッセージを送信（まとめて送信）
      await this.lineClient.pushMessage(lineUserId, messages)
      
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

  /**
   * コードのタイトルを生成
   */
  private generateCodeTitle(category?: string, summary?: string): string {
    const categoryPart = category || 'GAS'
    const summaryPart = summary ? summary.substring(0, 50) : 'コード'
    return `${categoryPart} - ${summaryPart}`
  }

  /**
   * タグを生成
   */
  private generateTags(category?: string, subcategory?: string): string[] {
    const tags: string[] = []
    if (category) tags.push(category.toLowerCase())
    if (subcategory) tags.push(subcategory.toLowerCase())
    tags.push('gas', 'google-apps-script')
    return [...new Set(tags)] // 重複を除去
  }

  /**
   * ユーザーのプレミアムステータスを確認
   */
  private async checkUserPremiumStatus(userId: string): Promise<boolean> {
    try {
      const { PremiumChecker } = await import('@/lib/premium/premium-checker')
      const status = await PremiumChecker.checkPremiumStatus(userId)
      return status.isPremium || false
    } catch (error) {
      logger.warn('Failed to check premium status', { userId, error })
      return false
    }
  }
}