import { logger } from '@/lib/utils/logger'
import { UsageQueries } from '@/lib/supabase/queries'
import { CLAUDE_CONFIG, TIMEOUTS, EXTERNAL_API_CONFIG } from '@/lib/constants/config'
import EnvironmentValidator from '@/lib/config/environment'
import type { 
  ClaudeApiRequest, 
  ClaudeApiResponse, 
  ClaudeApiError,
  ClaudeConfig 
} from '@/types/claude'

export class ClaudeApiClient {
  private apiKey: string
  private baseUrl: string
  private config: ClaudeConfig

  constructor() {
    // 環境変数を安全に取得（undefinedの場合は例外が発生）
    this.apiKey = EnvironmentValidator.getRequired('ANTHROPIC_API_KEY')
    this.baseUrl = EXTERNAL_API_CONFIG.ANTHROPIC.API_BASE_URL

    this.config = {
      apiKey: this.apiKey,
      model: CLAUDE_CONFIG.MODEL,
      maxTokens: CLAUDE_CONFIG.MAX_TOKENS,
      temperature: CLAUDE_CONFIG.TEMPERATURE,
      timeout: TIMEOUTS.CLAUDE_API
    }
  }

  /**
   * Claude APIにリクエストを送信（リトライ機能付き）
   */
  async sendMessage(
    messages: Array<{ role: 'user' | 'assistant', content: string }>,
    userId?: string,
    maxRetries: number = 3
  ): Promise<ClaudeApiResponse> {
    const startTime = Date.now()
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Claude API request attempt', { 
          attempt, 
          maxRetries,
          userId,
          messageCount: messages.length
        })

        const response = await this.makeApiRequest({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: this.config.temperature,
          messages
        })

        const processingTime = Date.now() - startTime

        // 成功ログ記録
        await this.logUsage(
          response.usage,
          true,
          processingTime,
          userId
        )

        logger.info('Claude API request successful', {
          attempt,
          processingTime,
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          userId
        })

        return response

      } catch (error) {
        lastError = error
        const processingTime = Date.now() - startTime

        logger.warn('Claude API request failed', { 
          attempt, 
          maxRetries,
          error: error instanceof Error ? error.message : String(error),
          processingTime,
          userId 
        })

        // エラーログ記録（最終試行のみ）
        if (attempt === maxRetries) {
          await this.logUsage(
            null,
            false,
            processingTime,
            userId,
            this.getErrorType(error)
          )
        }

        // レート制限の場合は待機
        if (this.isRateLimitError(error) && attempt < maxRetries) {
          const waitTime = this.calculateWaitTime(attempt, error)
          logger.info('Rate limited, waiting...', { waitTime, attempt })
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }

        // タイムアウトやネットワークエラーの場合は即座にリトライ
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000 // 指数バックオフ
          logger.info('Retryable error, waiting...', { waitTime, attempt })
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }

        // その他のエラーは即座に失敗
        break
      }
    }

    // すべてのリトライが失敗した場合
    const errorMessage = this.formatError(lastError)
    logger.error('Claude API request failed after all retries', { 
      maxRetries, 
      error: errorMessage,
      userId 
    })
    
    // フォールバック処理
    const fallbackText = '申し訳ございません。エラーが発生しました。もう一度お試しください。'
    
    // フォールバックレスポンスを返す（エラーをthrowしない）
    return {
      content: [{
        type: 'text',
        text: fallbackText
      }],
      id: 'fallback-' + Date.now(),
      model: this.config.model,
      role: 'assistant',
      stop_reason: 'error',
      stop_sequence: null,
      type: 'message',
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    }
  }

  /**
   * 実際のAPI呼び出し
   */
  private async makeApiRequest(request: ClaudeApiRequest): Promise<ClaudeApiResponse> {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': EXTERNAL_API_CONFIG.ANTHROPIC.API_VERSION
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(this.config.timeout)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return await response.json()
  }

  /**
   * 使用量ログ記録
   */
  private async logUsage(
    usage: { input_tokens: number; output_tokens: number } | null,
    success: boolean,
    processingTimeMs: number,
    userId?: string,
    errorType?: string
  ): Promise<void> {
    try {
      const inputTokens = usage?.input_tokens || 0
      const outputTokens = usage?.output_tokens || 0
      const estimatedCost = 
        (inputTokens * CLAUDE_CONFIG.COST_PER_INPUT_TOKEN) +
        (outputTokens * CLAUDE_CONFIG.COST_PER_OUTPUT_TOKEN)

      await UsageQueries.logClaudeUsage({
        user_id: userId || null,
        request_type: 'code_generation',
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        estimated_cost: estimatedCost,
        success,
        error_type: errorType || null,
        processing_time_ms: processingTimeMs
      })

    } catch (error) {
      logger.error('Failed to log Claude usage', { error })
    }
  }

  /**
   * エラータイプ判定
   */
  private getErrorType(error: unknown): string {
    const errorMessage = String(error)
    
    if (errorMessage.includes('429') || errorMessage.includes('rate')) {
      return 'rate_limit'
    }
    if (errorMessage.includes('timeout') || errorMessage.includes('AbortError')) {
      return 'timeout'
    }
    if (errorMessage.includes('401') || errorMessage.includes('403')) {
      return 'auth_error'
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'network_error'
    }
    
    return 'unknown_error'
  }

  /**
   * レート制限エラーかチェック
   */
  private isRateLimitError(error: unknown): boolean {
    return this.getErrorType(error) === 'rate_limit'
  }

  /**
   * リトライ可能なエラーかチェック
   */
  private isRetryableError(error: unknown): boolean {
    const errorType = this.getErrorType(error)
    return ['timeout', 'network_error', 'rate_limit'].includes(errorType)
  }

  /**
   * 待機時間を計算
   */
  private calculateWaitTime(attempt: number, error: unknown): number {
    // レート制限の場合は長めに待機
    if (this.isRateLimitError(error)) {
      return Math.pow(4, attempt) * 1000 // 4秒, 16秒, 64秒
    }
    
    // その他は指数バックオフ
    return Math.pow(2, attempt) * 1000 // 2秒, 4秒, 8秒
  }

  /**
   * エラーメッセージのフォーマット
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }

  /**
   * 日次使用量チェック
   */
  async checkDailyUsage(userId?: string): Promise<{
    requests: number
    cost: number
    withinLimit: boolean
  }> {
    try {
      const { requests, cost } = await UsageQueries.getDailyUsage(userId)
      const withinLimit = requests < 100 && cost < 30 // $30制限
      
      return { requests, cost, withinLimit }
      
    } catch (error) {
      logger.error('Failed to check daily usage', { userId, error })
      return { requests: 0, cost: 0, withinLimit: true }
    }
  }

  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.sendMessage([{
        role: 'user',
        content: 'Test message'
      }])
      return true
      
    } catch (error) {
      logger.error('Claude API connection test failed', { error })
      return false
    }
  }
}