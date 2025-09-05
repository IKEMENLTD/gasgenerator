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

      // 4. イベントフィルタリング（テキストメッセージのみ）
      const textEvents = validationResult.data.events.filter(event => 
        event.type === 'message' && 
        event.message.type === 'text' &&
        event.replyToken
      )

      if (textEvents.length === 0) {
        logger.debug('No text message events found', { requestId })
        return {
          isValid: true,
          events: [],
          errorMessage: 'No processable events'
        }
      }

      logger.info('Webhook validation successful', { 
        requestId, 
        eventCount: textEvents.length 
      })

      return {
        isValid: true,
        events: textEvents as any
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

// 重複イベント検出用のキャッシュ
const recentEventCache = new Set<string>()

export { recentEventCache }