import { logger } from '@/lib/utils/logger'
import { EXTERNAL_API_CONFIG, TIMEOUTS } from '@/lib/constants/config'
import EnvironmentValidator from '@/lib/config/environment'
import type { LineMessage, LinePushMessage } from '@/types/line'

export class LineApiClient {
  private accessToken: string
  private baseUrl: string

  constructor() {
    // 環境変数を安全に取得
    this.accessToken = EnvironmentValidator.getRequired('LINE_CHANNEL_ACCESS_TOKEN')
    this.baseUrl = EXTERNAL_API_CONFIG.LINE.API_BASE_URL
  }

  /**
   * ローディングアニメーションを表示（最大60秒）
   */
  async showLoadingAnimation(userId: string, durationSeconds: number = 20): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/loading/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          chatId: userId,
          loadingSeconds: Math.min(durationSeconds, 60) // 最大60秒
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('Loading animation API error', {
          status: response.status,
          error: errorText
        })
        return false
      }

      logger.info('Loading animation started', { userId, duration: durationSeconds })
      return true

    } catch (error) {
      logger.error('Failed to show loading animation', { error })
      return false
    }
  }

  /**
   * Reply APIを使った返信（replyTokenが必要）
   */
  async replyMessage(replyToken: string, messages: any[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/message/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          replyToken,
          messages: messages.slice(0, 5) // LINE APIは最大5メッセージまで
        }),
        signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST)
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('LINE reply API error', {
          status: response.status,
          error: errorText,
          replyToken
        })
        return false
      }

      logger.info('LINE reply sent successfully', {
        replyToken,
        messageCount: messages.length
      })

      return true

    } catch (error) {
      logger.error('LINE reply failed', {
        error: error instanceof Error ? error.message : String(error),
        replyToken
      })
      return false
    }
  }

  /**
   * Push APIを使った能動的メッセージ送信
   */
  async pushMessage(userId: string, messages: any[]): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/message/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: JSON.stringify({
          to: userId,
          messages: messages.slice(0, 5) // LINE APIは最大5メッセージまで
        }),
        signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST)
      })

      if (!response.ok) {
        const errorText = await response.text()
        logger.error('LINE push API error', {
          status: response.status,
          error: errorText,
          userId
        })
        return false
      }

      logger.info('LINE push sent successfully', {
        userId,
        messageCount: messages.length
      })

      return true

    } catch (error) {
      logger.error('LINE push failed', {
        error: error instanceof Error ? error.message : String(error),
        userId
      })
      return false
    }
  }

  /**
   * ユーザープロフィール取得
   */
  async getUserProfile(userId: string): Promise<{ displayName: string } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/profile/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        signal: AbortSignal.timeout(TIMEOUTS.HTTP_REQUEST)
      })

      if (!response.ok) {
        logger.warn('Failed to get user profile', {
          status: response.status,
          userId
        })
        return null
      }

      const profile = await response.json()
      return { displayName: profile.displayName }

    } catch (error) {
      logger.error('Get user profile failed', {
        error: error instanceof Error ? error.message : String(error),
        userId
      })
      return null
    }
  }

  /**
   * LINE API接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/info`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        signal: AbortSignal.timeout(5000)
      })

      return response.ok

    } catch (error) {
      logger.error('LINE API connection test failed', { error })
      return false
    }
  }
}