import { logger } from '@/lib/utils/logger'
import { UsageQueries } from '@/lib/supabase/queries'
import { CLAUDE_CONFIG, TIMEOUTS, EXTERNAL_API_CONFIG } from '@/lib/constants/config'
import EnvironmentValidator from '@/lib/config/environment'
import type { 
  ClaudeApiRequest, 
  ClaudeApiResponse,
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
    maxRetries: number = 3,
    customMaxTokens?: number
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

        // 動的トークン割り当て（入力トークン数に基づいて出力を最大化）
        const inputLength = JSON.stringify(messages).length
        const estimatedInputTokens = Math.ceil(inputLength / 4) // 約4文字で1トークン

        // カスタムトークンが指定されている場合はそれを使用
        if (customMaxTokens) {
          logger.debug('Using custom token allocation', { customMaxTokens })
          const optimalMaxTokens = customMaxTokens
          const response = await this.makeApiRequest({
            model: this.config.model,
            max_tokens: optimalMaxTokens,
            temperature: this.config.temperature,
            messages
          })
          const processingTime = Date.now() - startTime
          await this.logUsage(response.usage, true, processingTime, userId)
          logger.info('Claude API request successful', {
            attempt,
            processingTime,
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
            userId
          })
          return response
        }

        // コンテンツタイプの詳細分析
        const content = messages.map(m => m.content).join(' ').toLowerCase()

        // タスクタイプの判定（優先度順）
        const taskType = this.detectTaskType(content)

        // タスクタイプに応じた最適なトークン割り当て
        let optimalMaxTokens: number

        switch (taskType) {
          case 'full_code_generation':
            // 完全なコード生成（複雑なスクリプト）
            if (estimatedInputTokens < 500) {
              optimalMaxTokens = 16000  // シンプルな要件
            } else if (estimatedInputTokens < 2000) {
              optimalMaxTokens = 24000  // 中程度の要件
            } else if (estimatedInputTokens < 5000) {
              optimalMaxTokens = 32000  // 詳細な要件
            } else {
              optimalMaxTokens = 48000  // 非常に複雑な要件
            }
            break

          case 'code_modification':
            // コードの修正・改善
            if (estimatedInputTokens < 1000) {
              optimalMaxTokens = 8000   // 小さな修正
            } else if (estimatedInputTokens < 3000) {
              optimalMaxTokens = 12000  // 中規模な修正
            } else {
              optimalMaxTokens = 20000  // 大規模な修正
            }
            break

          case 'data_processing':
            // データ処理・集計系
            if (estimatedInputTokens < 500) {
              optimalMaxTokens = 6000   // 簡単な処理
            } else if (estimatedInputTokens < 2000) {
              optimalMaxTokens = 12000  // 複雑な処理
            } else {
              optimalMaxTokens = 24000  // 大規模データ処理
            }
            break

          case 'api_integration':
            // API連携・外部サービス統合
            if (estimatedInputTokens < 1000) {
              optimalMaxTokens = 10000  // シンプルなAPI
            } else if (estimatedInputTokens < 3000) {
              optimalMaxTokens = 18000  // 複数API連携
            } else {
              optimalMaxTokens = 28000  // 複雑な統合
            }
            break

          case 'automation':
            // 自動化・トリガー系
            if (estimatedInputTokens < 800) {
              optimalMaxTokens = 8000   // 基本的な自動化
            } else if (estimatedInputTokens < 2500) {
              optimalMaxTokens = 14000  // 条件分岐あり
            } else {
              optimalMaxTokens = 22000  // 複雑なワークフロー
            }
            break

          case 'explanation':
            // 説明・解説系
            if (estimatedInputTokens < 500) {
              optimalMaxTokens = 3000   // 簡単な説明
            } else if (estimatedInputTokens < 1500) {
              optimalMaxTokens = 5000   // 詳細な説明
            } else {
              optimalMaxTokens = 8000   // 包括的な解説
            }
            break

          case 'debugging':
            // デバッグ・エラー解決
            if (estimatedInputTokens < 1000) {
              optimalMaxTokens = 6000   // 簡単なエラー
            } else if (estimatedInputTokens < 3000) {
              optimalMaxTokens = 10000  // 複雑なバグ
            } else {
              optimalMaxTokens = 16000  // システムレベルの問題
            }
            break

          case 'simple_query':
            // 簡単な質問・確認
            optimalMaxTokens = 2000
            break

          default:
            // デフォルト（入力長に基づく）
            if (estimatedInputTokens < 300) {
              optimalMaxTokens = 4000
            } else if (estimatedInputTokens < 1000) {
              optimalMaxTokens = 8000
            } else if (estimatedInputTokens < 3000) {
              optimalMaxTokens = 12000
            } else if (estimatedInputTokens < 5000) {
              optimalMaxTokens = 20000
            } else if (estimatedInputTokens < 10000) {
              optimalMaxTokens = 32000
            } else {
              optimalMaxTokens = 48000
            }
        }

        // 最大値制限（Claude Sonnet 4は64Kまで）
        optimalMaxTokens = Math.min(optimalMaxTokens, this.config.maxTokens)

        logger.debug('Advanced token allocation', {
          estimatedInputTokens,
          taskType,
          optimalMaxTokens,
          contentLength: inputLength
        })

        const response = await this.makeApiRequest({
          model: this.config.model,
          max_tokens: optimalMaxTokens,
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
        lastError = error instanceof Error ? error : new Error(String(error))
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
      stop_reason: 'end_turn' as const,
      stop_sequence: null,
      type: 'message',
      usage: {
        input_tokens: 0,
        output_tokens: 0
      }
    }
  }

  /**
   * タスクタイプを検出
   */
  private detectTaskType(content: string): string {
    // コード生成関連のキーワード
    const codeGenerationKeywords = ['作成', '作って', '生成', 'create', 'make', 'build', 'generate', '新しい', 'new']
    const codeModificationKeywords = ['修正', '変更', '改善', 'fix', 'modify', 'update', 'change', 'refactor', '直して']
    const dataProcessingKeywords = ['集計', 'データ', '抽出', 'aggregate', 'data', 'extract', 'process', 'calculate', '計算']
    const apiKeywords = ['api', 'webhook', 'fetch', 'http', 'request', '外部', 'external', '連携']
    const automationKeywords = ['自動', 'trigger', 'schedule', 'cron', '定期', 'automatic', '毎日', '毎週', '毎月']
    const debugKeywords = ['エラー', 'error', 'bug', 'debug', '動かない', 'not working', '失敗', 'fail']
    const explainKeywords = ['説明', 'explain', 'what', 'なに', 'どう', 'how', '教えて']

    // フルコード生成（新規作成）
    if (codeGenerationKeywords.some(keyword => content.includes(keyword)) &&
        !codeModificationKeywords.some(keyword => content.includes(keyword))) {
      if (content.includes('gas') || content.includes('script') || content.includes('コード')) {
        return 'full_code_generation'
      }
    }

    // コード修正
    if (codeModificationKeywords.some(keyword => content.includes(keyword))) {
      return 'code_modification'
    }

    // データ処理
    if (dataProcessingKeywords.some(keyword => content.includes(keyword))) {
      return 'data_processing'
    }

    // API連携
    if (apiKeywords.some(keyword => content.includes(keyword))) {
      return 'api_integration'
    }

    // 自動化
    if (automationKeywords.some(keyword => content.includes(keyword))) {
      return 'automation'
    }

    // デバッグ
    if (debugKeywords.some(keyword => content.includes(keyword))) {
      return 'debugging'
    }

    // 説明・解説
    if (explainKeywords.some(keyword => content.includes(keyword))) {
      return 'explanation'
    }

    // 簡単な質問（短い入力）
    if (content.length < 100) {
      return 'simple_query'
    }

    return 'general'
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
    _success: boolean,
    _processingTimeMs: number,
    userId?: string,
    _errorType?: string
  ): Promise<void> {
    try {
      const inputTokens = usage?.input_tokens || 0
      const outputTokens = usage?.output_tokens || 0
      const estimatedCost = 
        (inputTokens * CLAUDE_CONFIG.COST_PER_INPUT_TOKEN) +
        (outputTokens * CLAUDE_CONFIG.COST_PER_OUTPUT_TOKEN)

      await UsageQueries.logClaudeUsage({
        userId: userId || '',
        model: this.config.model,
        promptTokens: inputTokens,
        completionTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost: estimatedCost
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