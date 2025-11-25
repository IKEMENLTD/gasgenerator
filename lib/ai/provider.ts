import { logger } from '@/lib/utils/logger'
import { ClaudeApiClient } from '@/lib/claude/client'
import { GeminiApiClient, AIResponse } from '@/lib/gemini/client'
import type { ClaudeApiResponse } from '@/types/claude'

type AIProvider = 'claude' | 'gemini'

interface ProviderStatus {
  available: boolean
  lastError?: string
  lastErrorTime?: number
  consecutiveFailures: number
}

// フォールバック設定
const FALLBACK_CONFIG = {
  // 連続失敗でフォールバック発動（1回失敗で即切り替え）
  MAX_CONSECUTIVE_FAILURES: 1,
  // エラー後のクールダウン時間（ミリ秒）
  COOLDOWN_MS: 5 * 60 * 1000, // 5分
  // フォールバック対象のエラーパターン
  FALLBACK_ERROR_PATTERNS: [
    'rate_limit',
    '429',
    'overloaded',
    'credit',
    'quota',
    'billing',
    '529',
    'capacity'
  ]
}

export class AIProviderManager {
  private static instance: AIProviderManager | null = null

  private claudeClient: ClaudeApiClient
  private geminiClient: GeminiApiClient
  private providerStatus: Map<AIProvider, ProviderStatus> = new Map()
  private primaryProvider: AIProvider = 'claude'

  private constructor() {
    this.claudeClient = new ClaudeApiClient()
    this.geminiClient = new GeminiApiClient()

    // 初期ステータス設定
    this.providerStatus.set('claude', {
      available: true,
      consecutiveFailures: 0
    })
    this.providerStatus.set('gemini', {
      available: this.geminiClient.isAvailable(),
      consecutiveFailures: 0
    })

    logger.info('AI Provider Manager initialized', {
      claudeAvailable: true,
      geminiAvailable: this.geminiClient.isAvailable()
    })
  }

  static getInstance(): AIProviderManager {
    if (!this.instance) {
      this.instance = new AIProviderManager()
    }
    return this.instance
  }

  /**
   * メッセージを送信（自動フォールバック付き）
   */
  async sendMessage(
    messages: Array<{
      role: 'user' | 'assistant'
      content: string | Array<{
        type: 'image' | 'text'
        source?: { type: string; media_type: string; data: string }
        text?: string
      }>
    }>,
    userId?: string,
    maxRetries: number = 3,
    customMaxTokens?: number
  ): Promise<ClaudeApiResponse & { provider?: AIProvider }> {

    // プライマリプロバイダーを決定
    const provider = this.selectProvider()

    logger.info('AI request starting', {
      provider,
      userId,
      messageCount: messages.length
    })

    try {
      const response = await this.executeWithProvider(
        provider,
        messages,
        userId,
        maxRetries,
        customMaxTokens
      )

      // 成功したらステータスをリセット
      this.markSuccess(provider)

      return { ...response, provider }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // エラーを記録
      this.markFailure(provider, errorMessage)

      // フォールバック対象のエラーかチェック
      if (this.shouldFallback(errorMessage)) {
        const fallbackProvider = this.getFallbackProvider(provider)

        if (fallbackProvider) {
          logger.warn('Falling back to alternative provider', {
            from: provider,
            to: fallbackProvider,
            reason: errorMessage,
            userId
          })

          try {
            const fallbackResponse = await this.executeWithProvider(
              fallbackProvider,
              messages,
              userId,
              2, // フォールバックはリトライ少なめ
              customMaxTokens
            )

            this.markSuccess(fallbackProvider)

            return { ...fallbackResponse, provider: fallbackProvider }

          } catch (fallbackError) {
            const fallbackErrorMessage = fallbackError instanceof Error
              ? fallbackError.message
              : String(fallbackError)

            this.markFailure(fallbackProvider, fallbackErrorMessage)

            logger.error('Fallback provider also failed', {
              fallbackProvider,
              error: fallbackErrorMessage,
              userId
            })
          }
        }
      }

      // フォールバックレスポンスを返す
      logger.error('All AI providers failed', {
        primaryProvider: provider,
        error: errorMessage,
        userId
      })

      return this.createFallbackResponse()
    }
  }

  /**
   * 指定プロバイダーで実行
   */
  private async executeWithProvider(
    provider: AIProvider,
    messages: Array<{
      role: 'user' | 'assistant'
      content: string | Array<{
        type: 'image' | 'text'
        source?: { type: string; media_type: string; data: string }
        text?: string
      }>
    }>,
    userId?: string,
    maxRetries?: number,
    customMaxTokens?: number
  ): Promise<ClaudeApiResponse> {
    if (provider === 'claude') {
      return await this.claudeClient.sendMessage(
        messages,
        userId,
        maxRetries,
        customMaxTokens
      )
    } else {
      // Gemini のレスポンスを Claude 形式に変換
      const geminiResponse = await this.geminiClient.sendMessage(
        messages,
        userId,
        maxRetries
      )
      return this.convertGeminiToClaude(geminiResponse)
    }
  }

  /**
   * プロバイダーを選択
   */
  private selectProvider(): AIProvider {
    const claudeStatus = this.providerStatus.get('claude')!
    const geminiStatus = this.providerStatus.get('gemini')!

    // Claude がクールダウン中かチェック
    if (claudeStatus.lastErrorTime) {
      const elapsed = Date.now() - claudeStatus.lastErrorTime
      if (elapsed < FALLBACK_CONFIG.COOLDOWN_MS &&
          claudeStatus.consecutiveFailures >= FALLBACK_CONFIG.MAX_CONSECUTIVE_FAILURES) {
        // Gemini が使用可能ならそちらを使う
        if (geminiStatus.available) {
          logger.info('Claude in cooldown, using Gemini', {
            claudeFailures: claudeStatus.consecutiveFailures,
            cooldownRemaining: FALLBACK_CONFIG.COOLDOWN_MS - elapsed
          })
          return 'gemini'
        }
      }
    }

    return this.primaryProvider
  }

  /**
   * フォールバックプロバイダーを取得
   */
  private getFallbackProvider(currentProvider: AIProvider): AIProvider | null {
    if (currentProvider === 'claude') {
      const geminiStatus = this.providerStatus.get('gemini')!
      if (geminiStatus.available) {
        return 'gemini'
      }
    } else if (currentProvider === 'gemini') {
      // Gemini がフォールバック元の場合、Claude に戻す（クールダウン終了していれば）
      const claudeStatus = this.providerStatus.get('claude')!
      if (claudeStatus.lastErrorTime) {
        const elapsed = Date.now() - claudeStatus.lastErrorTime
        if (elapsed >= FALLBACK_CONFIG.COOLDOWN_MS) {
          return 'claude'
        }
      }
    }
    return null
  }

  /**
   * フォールバック対象のエラーかチェック
   */
  private shouldFallback(errorMessage: string): boolean {
    const lowerError = errorMessage.toLowerCase()
    return FALLBACK_CONFIG.FALLBACK_ERROR_PATTERNS.some(
      pattern => lowerError.includes(pattern)
    )
  }

  /**
   * 成功を記録
   */
  private markSuccess(provider: AIProvider): void {
    const status = this.providerStatus.get(provider)!
    status.consecutiveFailures = 0
    status.lastError = undefined
    // lastErrorTime はクールダウン用に残す
  }

  /**
   * 失敗を記録
   */
  private markFailure(provider: AIProvider, error: string): void {
    const status = this.providerStatus.get(provider)!
    status.consecutiveFailures++
    status.lastError = error
    status.lastErrorTime = Date.now()

    logger.warn('Provider failure recorded', {
      provider,
      consecutiveFailures: status.consecutiveFailures,
      error
    })
  }

  /**
   * Gemini レスポンスを Claude 形式に変換
   */
  private convertGeminiToClaude(geminiResponse: AIResponse): ClaudeApiResponse {
    return {
      content: geminiResponse.content,
      id: geminiResponse.id,
      model: geminiResponse.model,
      role: 'assistant',
      stop_reason: geminiResponse.stop_reason,
      stop_sequence: null,
      type: 'message',
      usage: geminiResponse.usage
    }
  }

  /**
   * フォールバックレスポンスを生成
   */
  private createFallbackResponse(): ClaudeApiResponse {
    return {
      content: [{
        type: 'text',
        text: '申し訳ございません。現在AIサービスが混み合っております。しばらく時間をおいて再度お試しください。'
      }],
      id: `fallback-${Date.now()}`,
      model: 'fallback',
      role: 'assistant',
      stop_reason: 'end_turn',
      stop_sequence: null,
      type: 'message',
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    }
  }

  /**
   * プロバイダーのステータスを取得
   */
  getStatus(): Record<AIProvider, ProviderStatus> {
    return {
      claude: this.providerStatus.get('claude')!,
      gemini: this.providerStatus.get('gemini')!
    }
  }

  /**
   * プライマリプロバイダーを設定
   */
  setPrimaryProvider(provider: AIProvider): void {
    this.primaryProvider = provider
    logger.info('Primary AI provider changed', { provider })
  }

  /**
   * 手動でプロバイダーをリセット
   */
  resetProvider(provider: AIProvider): void {
    this.providerStatus.set(provider, {
      available: provider === 'gemini' ? this.geminiClient.isAvailable() : true,
      consecutiveFailures: 0
    })
    logger.info('Provider status reset', { provider })
  }
}

// シングルトンインスタンスをエクスポート
export const aiProvider = AIProviderManager.getInstance()
