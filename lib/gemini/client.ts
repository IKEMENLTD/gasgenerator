import { logger } from '@/lib/utils/logger'
import { GEMINI_CONFIG, TIMEOUTS } from '@/lib/constants/config'

// Gemini API レスポンス型
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
      role?: string
    }
    finishReason?: string
  }>
  usageMetadata?: {
    promptTokenCount: number
    candidatesTokenCount: number
    totalTokenCount: number
  }
}

// 統一レスポンス型（Claude互換）
export interface AIResponse {
  content: Array<{ type: 'text'; text: string }>
  id: string
  model: string
  role: 'assistant'
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence'
  stop_sequence: null
  type: 'message'
  usage: {
    input_tokens: number
    output_tokens: number
  }
  provider: 'gemini'
}

export class GeminiApiClient {
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || ''
    this.model = GEMINI_CONFIG.MODEL
    this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
  }

  /**
   * APIキーが設定されているかチェック
   */
  isAvailable(): boolean {
    return !!this.apiKey && this.apiKey.length > 0
  }

  /**
   * Gemini APIにリクエストを送信
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
    maxRetries: number = 2
  ): Promise<AIResponse> {
    const startTime = Date.now()
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Gemini API request attempt', {
          attempt,
          maxRetries,
          userId,
          messageCount: messages.length
        })

        // Claude形式からGemini形式に変換
        const geminiContents = this.convertToGeminiFormat(messages)

        const response = await this.makeApiRequest(geminiContents)
        const processingTime = Date.now() - startTime

        // レスポンスを検証して抽出
        const text = this.extractText(response)

        logger.info('Gemini API request successful', {
          attempt,
          processingTime,
          inputTokens: response.usageMetadata?.promptTokenCount || 0,
          outputTokens: response.usageMetadata?.candidatesTokenCount || 0,
          userId
        })

        // Claude互換形式で返す
        return {
          content: [{ type: 'text', text }],
          id: `gemini-${Date.now()}`,
          model: this.model,
          role: 'assistant',
          stop_reason: 'end_turn',
          stop_sequence: null,
          type: 'message',
          usage: {
            input_tokens: response.usageMetadata?.promptTokenCount || 0,
            output_tokens: response.usageMetadata?.candidatesTokenCount || 0
          },
          provider: 'gemini'
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        const processingTime = Date.now() - startTime

        logger.warn('Gemini API request failed', {
          attempt,
          maxRetries,
          error: lastError.message,
          processingTime,
          userId
        })

        // レート制限の場合は待機
        if (this.isRateLimitError(error) && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000
          logger.info('Gemini rate limited, waiting...', { waitTime, attempt })
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }

        // リトライ可能なエラー
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 500
          await new Promise(resolve => setTimeout(resolve, waitTime))
          continue
        }

        break
      }
    }

    // 全てのリトライが失敗
    logger.error('Gemini API request failed after all retries', {
      maxRetries,
      error: lastError?.message,
      userId
    })

    throw lastError || new Error('Gemini API request failed')
  }

  /**
   * Claude形式のメッセージをGemini形式に変換
   */
  private convertToGeminiFormat(
    messages: Array<{
      role: 'user' | 'assistant'
      content: string | Array<{
        type: 'image' | 'text'
        source?: { type: string; media_type: string; data: string }
        text?: string
      }>
    }>
  ): Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }> {
    return messages.map(msg => {
      const role = msg.role === 'assistant' ? 'model' : 'user'

      if (typeof msg.content === 'string') {
        return {
          role,
          parts: [{ text: msg.content }]
        }
      }

      // 配列の場合（画像を含む可能性）
      const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = []

      for (const item of msg.content) {
        if (item.type === 'text' && item.text) {
          parts.push({ text: item.text })
        } else if (item.type === 'image' && item.source) {
          parts.push({
            inlineData: {
              mimeType: item.source.media_type,
              data: item.source.data
            }
          })
        }
      }

      return { role, parts }
    })
  }

  /**
   * 実際のAPI呼び出し
   */
  private async makeApiRequest(
    contents: Array<{ role: string; parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>
  ): Promise<GeminiResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUTS.CLAUDE_API)

    try {
      const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: GEMINI_CONFIG.TEMPERATURE,
            maxOutputTokens: GEMINI_CONFIG.MAX_OUTPUT_TOKENS,
            topP: 0.95,
            topK: 40
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
          ]
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gemini HTTP ${response.status}: ${errorText}`)
      }

      return await response.json()

    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * レスポンスからテキストを抽出
   */
  private extractText(response: GeminiResponse): string {
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      logger.error('Invalid Gemini response structure', { response })
      throw new Error('Gemini returned empty or invalid response')
    }

    return text
  }

  /**
   * レート制限エラーかチェック
   */
  private isRateLimitError(error: unknown): boolean {
    const message = String(error)
    return message.includes('429') || message.includes('RESOURCE_EXHAUSTED')
  }

  /**
   * リトライ可能なエラーかチェック
   */
  private isRetryableError(error: unknown): boolean {
    const message = String(error)
    return (
      message.includes('timeout') ||
      message.includes('AbortError') ||
      message.includes('UNAVAILABLE') ||
      message.includes('500') ||
      message.includes('502') ||
      message.includes('503')
    )
  }
}
