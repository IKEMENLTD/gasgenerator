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
        if (result.status === 'fulfilled') {
          processed++
        } else {
          errors++
          logger.error('Job processing failed', { error: result.reason })
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
   * 個別ジョブの処理
   */
  private async processJob(job: QueueJob): Promise<void> {
    const jobId = job.id
    const startTime = Date.now()

    // 重複実行防止
    if (this.currentJobs.has(jobId)) {
      logger.warn('Job already being processed', { jobId })
      return
    }

    this.currentJobs.add(jobId)

    try {
      logger.info('Processing job', { 
        jobId, 
        userId: job.user_id,
        category: job.requirements.category 
      })

      // 1. ジョブを処理中状態に更新
      await QueueManager.startProcessing(jobId)

      // 2. コード生成リクエストを構築
      const request: CodeGenerationRequest = {
        userId: job.user_id,
        lineUserId: job.line_user_id,
        sessionId: job.session_id,
        category: job.requirements.category,
        subcategory: job.requirements.subcategory,
        requirements: job.requirements.requirements,
        userHistory: job.requirements.userHistory
      }

      // 3. プロンプト構築
      const prompt = await PromptBuilder.buildCodeGenerationPrompt(request)

      // 4. Claude API呼び出し
      const claudeResponse = await this.claudeClient.sendMessage([{
        role: 'user',
        content: prompt
      }], job.user_id)

      // 5. レスポンス解析
      const codeResponse = ResponseParser.parseCodeResponse(claudeResponse)

      // 6. 品質チェック
      const qualityCheck = ResponseParser.evaluateResponseQuality(codeResponse)
      if (qualityCheck.score < 50) {
        logger.warn('Low quality response detected', {
          jobId,
          score: qualityCheck.score,
          issues: qualityCheck.issues
        })
      }

      // 7. データベースに保存
      await CodeQueries.saveGeneratedCode({
        user_id: job.user_id,
        session_id: job.session_id,
        requirements_summary: this.summarizeRequirements(job.requirements),
        generated_code: codeResponse.code,
        explanation: codeResponse.explanation,
        usage_steps: codeResponse.steps,
        code_category: job.requirements.category,
        code_subcategory: job.requirements.subcategory,
        claude_prompt: prompt,
        claude_response_metadata: {
          responseId: claudeResponse.id,
          model: claudeResponse.model,
          stopReason: claudeResponse.stop_reason,
          usage: claudeResponse.usage,
          qualityScore: qualityCheck.score,
          processingTime: Date.now() - startTime
        }
      })

      // 8. LINEに結果を送信
      await this.sendResultToUser(job.line_user_id, codeResponse, job.requirements.category)

      // 9. ジョブを完了状態に更新
      await QueueManager.completeJob(jobId)

      const processingTime = Date.now() - startTime
      logger.info('Job completed successfully', {
        jobId,
        processingTime,
        qualityScore: qualityCheck.score
      })

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
      } catch (pushError) {
        logger.error('Failed to send error message to user', { 
          jobId,
          pushError 
        })
      }

      // ジョブを失敗状態に更新
      await QueueManager.failJob(jobId, errorMessage)

    } finally {
      this.currentJobs.delete(jobId)
    }
  }

  /**
   * 要件の要約
   */
  private summarizeRequirements(requirements: any): string {
    const parts: string[] = []
    
    if (requirements.category) {
      parts.push(requirements.category)
    }
    
    if (requirements.subcategory) {
      parts.push(requirements.subcategory)
    }
    
    if (requirements.requirements?.details) {
      const details = requirements.requirements.details
      parts.push(details.length > 100 ? details.substring(0, 100) + '...' : details)
    }

    return parts.join(' - ')
  }

  /**
   * ユーザーに結果を送信
   */
  private async sendResultToUser(
    lineUserId: string,
    codeResponse: any,
    category: string
  ): Promise<void> {
    try {
      const messages = MessageTemplates.createCodeResult(
        this.generateSummary(codeResponse, category),
        codeResponse.explanation,
        codeResponse.code
      )

      const success = await this.lineClient.pushMessage(lineUserId, messages)
      
      if (!success) {
        throw new Error('Failed to send LINE push message')
      }

      logger.info('Result sent to user', { lineUserId, category })

    } catch (error) {
      logger.error('Failed to send result to user', { lineUserId, error })
      throw error
    }
  }

  /**
   * コード要約の生成
   */
  private generateSummary(codeResponse: any, category: string): string {
    const categoryNames: Record<string, string> = {
      spreadsheet: 'スプレッドシート操作',
      gmail: 'Gmail自動化',
      calendar: 'カレンダー連携',
      api: 'API連携',
      custom: 'カスタム'
    }

    const categoryName = categoryNames[category] || 'GAS'
    
    // コードの行数
    const codeLines = codeResponse.code.split('\n').filter((line: string) => line.trim()).length
    
    return `${categoryName}のコードを生成しました（${codeLines}行）`
  }

  /**
   * プロセッサの健全性チェック
   */
  async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    stats: {
      isProcessing: boolean
      currentJobs: number
    }
  }> {
    const issues: string[] = []

    try {
      // Claude API接続テスト
      const claudeHealthy = await this.claudeClient.testConnection()
      if (!claudeHealthy) {
        issues.push('Claude API connection failed')
      }

      // LINE API接続テスト
      const lineHealthy = await this.lineClient.testConnection()
      if (!lineHealthy) {
        issues.push('LINE API connection failed')
      }

      // 使用量制限チェック
      const usageCheck = await ClaudeUsageTracker.checkUsageLimits()
      if (!usageCheck.allowed) {
        issues.push(`Usage limits exceeded: ${usageCheck.reason}`)
      }

    } catch (error) {
      issues.push(`Health check failed: ${error}`)
    }

    return {
      healthy: issues.length === 0,
      issues,
      stats: {
        isProcessing: this.isProcessing,
        currentJobs: this.currentJobs.size
      }
    }
  }

  /**
   * 緊急停止
   */
  async emergencyStop(): Promise<void> {
    logger.warn('Emergency stop initiated')
    
    this.isProcessing = false
    this.currentJobs.clear()
    
    // 現在処理中のジョブは中断される
    // 必要に応じて処理中ジョブを pending 状態に戻す処理を追加
  }
}