import { validateLineSignature } from '@/lib/utils/crypto'
import { LineWebhookEventSchema } from '@/lib/utils/validators'
import { logger } from '@/lib/utils/logger'
import type { LineWebhookBody, LineWebhookEvent } from '@/types/line'

export interface WebhookValidationResult {
  isValid: boolean
  events: LineWebhookEvent[]
  errorMessage?: string
}

export class LineWebhookValidator {
  /**
   * LINE Webhookリクエストの完全検証
   */
  static async validate(
    body: string,
    signature: string | null,
    requestId: string
  ): Promise<WebhookValidationResult> {
    try {
      // 1. 署名検証
      if (!(await this.validateSignature(body, signature, requestId))) {
        return {
          isValid: false,
          events: [],
          errorMessage: 'Invalid signature'
        }
      }

      // 2. JSONパース
      let parsedBody: LineWebhookBody
      try {
        parsedBody = JSON.parse(body)
      } catch (error) {
        logger.warn('Failed to parse webhook body', { requestId, error })
        return {
          isValid: false,
          events: [],
          errorMessage: 'Invalid JSON format'
        }
      }

      // 3. スキーマ検証
      const validationResult = LineWebhookEventSchema.safeParse(parsedBody)
      if (!validationResult.success) {
        logger.warn('Webhook schema validation failed', { 
          requestId, 
          errors: validationResult.error.issues 
        })
        return {
          isValid: false,
          events: [],
          errorMessage: 'Invalid event schema'
        }
      }

      // 4. すべてのイベントを返す（フィルタリングは呼び出し側で行う）
      const allEvents = validationResult.data.events

      logger.info('Webhook validation successful', { 
        requestId, 
        eventCount: allEvents.length,
        eventTypes: allEvents.map(e => e.type)
      })

      return {
        isValid: true,
        events: allEvents as any
      }

    } catch (error) {
      logger.error('Webhook validation error', { requestId, error })
      return {
        isValid: false,
        events: [],
        errorMessage: 'Validation failed'
      }
    }
  }

  /**
   * LINE署名検証
   */
  private static async validateSignature(
    body: string, 
    signature: string | null, 
    requestId: string
  ): Promise<boolean> {
    if (!signature) {
      logger.warn('Missing LINE signature', { requestId })
      return false
    }

    const isValid = await validateLineSignature(body, signature)
    
    if (!isValid) {
      logger.warn('Invalid LINE signature', { requestId })
    }

    return isValid
  }

  /**
   * 重複イベント検証（同一タイムスタンプ + ユーザーID）
   */
  static isDuplicateEvent(event: LineWebhookEvent, recentEvents: Set<string>): boolean {
    const eventKey = `${event.source.userId}_${event.timestamp}`
    
    if (recentEvents.has(eventKey)) {
      logger.warn('Duplicate event detected', { 
        userId: event.source.userId,
        timestamp: event.timestamp
      })
      return true
    }

    recentEvents.add(eventKey)
    
    // 古いイベントキーをクリーンアップ（5分以上古い）
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    for (const key of recentEvents) {
      const [, timestampStr] = key.split('_')
      const timestamp = parseInt(timestampStr)
      if (timestamp < fiveMinutesAgo) {
        recentEvents.delete(key)
      }
    }

    return false
  }
}

// 重複イベント検出用のキャッシュ（最大サイズ制限付き）
class LimitedEventCache {
  private cache = new Set<string>()
  private readonly maxSize = 1000 // 最大1000イベントまで保持
  private readonly ttl = 5 * 60 * 1000 // 5分間のTTL
  
  has(key: string): boolean {
    return this.cache.has(key)
  }
  
  add(key: string): void {
    // サイズ制限チェック
    if (this.cache.size >= this.maxSize) {
      // 最も古いエントリを削除
      const firstKey = this.cache.values().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.add(key)
    
    // 定期的なクリーンアップ（100イベントごと）
    if (this.cache.size % 100 === 0) {
      this.cleanup()
    }
  }
  
  cleanup(): void {
    const now = Date.now()
    const expired: string[] = []
    
    for (const key of this.cache) {
      const [, timestampStr] = key.split('_')
      const timestamp = parseInt(timestampStr)
      if (now - timestamp > this.ttl) {
        expired.push(key)
      }
    }
    
    // 期限切れのエントリを削除
    for (const key of expired) {
      this.cache.delete(key)
    }
  }
  
  clear(): void {
    this.cache.clear()
  }
  
  get size(): number {
    return this.cache.size
  }
}

const recentEventCache = new LimitedEventCache()

export { recentEventCache }