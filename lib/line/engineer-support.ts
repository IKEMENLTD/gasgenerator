import { LineApiClient } from './client'
import { logger } from '../utils/logger'
import { supabaseAdmin } from '../supabase/client'

interface EngineerSupportRequest {
  userId: string
  userName: string
  userMessage: string
  context: {
    lastGeneratedCode?: string
    errorMessage?: string
    conversationHistory?: any[]
  }
  timestamp: Date
}

export class EngineerSupportSystem {
  private lineClient: LineApiClient
  private supportGroupId: string
  private engineerUserIds: string[]

  constructor() {
    this.lineClient = new LineApiClient()
    // 環境変数から設定を読み込み
    this.supportGroupId = process.env.ENGINEER_SUPPORT_GROUP_ID || ''
    this.engineerUserIds = (process.env.ENGINEER_USER_IDS || '').split(',').filter(id => id)
  }

  /**
   * エンジニアサポートリクエストを処理
   */
  async handleSupportRequest(
    userId: string,
    message: string,
    replyToken: string
  ): Promise<void> {
    try {
      // 1. ユーザー情報を取得
      const userProfile = await this.lineClient.getUserProfile(userId)
      
      // 2. 最新のコンテキストを取得
      const context = await this.getUserContext(userId)
      
      // 3. サポートリクエストを作成
      const supportRequest: EngineerSupportRequest = {
        userId,
        userName: userProfile?.displayName || 'Unknown User',
        userMessage: message,
        context,
        timestamp: new Date()
      }
      
      // 4. エンジニアグループに通知
      await this.notifyEngineers(supportRequest)
      
      // 5. サポートリクエストをDBに保存
      await this.saveSupportRequest(supportRequest)
      
      // 6. ユーザーに確認メッセージを送信
      await this.lineClient.replyMessage(replyToken, [
        {
          type: 'text',
          text: '👨‍💻 エンジニアへの相談を受け付けました！\n\n弊社のエンジニアチームに通知を送信しました。\n営業時間内（平日10:00-19:00）であれば、数分以内に返信させていただきます。\n\nしばらくお待ちください。'
        },
        {
          type: 'sticker',
          packageId: '11537',
          stickerId: '52002744'  // サポートスタンプ
        }
      ])
      
      logger.info('Engineer support request created', { 
        userId, 
        requestId: supportRequest.timestamp.getTime() 
      })
      
    } catch (error) {
      logger.error('Failed to handle support request', { error, userId })
      
      // エラー時もユーザーには返信
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '⚠️ 申し訳ございません。\nエンジニアへの連絡中にエラーが発生しました。\n\n直接お問い合わせください：\nsupport@example.com'
      }])
    }
  }

  /**
   * エンジニアグループに通知を送信
   */
  private async notifyEngineers(request: EngineerSupportRequest): Promise<void> {
    const notificationMessage = await this.createNotificationMessage(request)
    
    // グループチャットに送信
    if (this.supportGroupId) {
      await this.lineClient.pushMessage(this.supportGroupId, notificationMessage)
    }
    
    // 個別のエンジニアにも通知（オプション）
    if (this.engineerUserIds.length > 0) {
      const urgentRequests = this.isUrgent(request)
      if (urgentRequests) {
        // 緊急の場合は個別通知も送る
        await Promise.all(
          this.engineerUserIds.map(engineerId =>
            this.lineClient.pushMessage(engineerId, [{
              type: 'text',
              text: '🚨 緊急サポート要請があります！\nグループチャットを確認してください。'
            }])
          )
        )
      }
    }
  }

  /**
   * 通知メッセージを作成
   */
  private async createNotificationMessage(request: EngineerSupportRequest): Promise<any[]> {
    const messages = []

    // ユーザーの課金状況を取得
    const subscriptionStatus = await this.getUserSubscriptionStatus(request.userId)

    // メインの通知メッセージ
    messages.push({
      type: 'text',
      text: `🆘 サポートリクエスト

👤 ユーザー: ${request.userName}
🆔 ID: ${request.userId}
📅 時刻: ${request.timestamp.toLocaleString('ja-JP')}
${subscriptionStatus.icon} 課金状況: ${subscriptionStatus.text}

💬 相談内容:
${request.userMessage}

${request.context.errorMessage ? `\n⚠️ エラー:\n${request.context.errorMessage}` : ''}

対応お願いします！`
    })
    
    // 最後に生成したコードがあれば添付
    if (request.context.lastGeneratedCode) {
      messages.push({
        type: 'text',
        text: `📝 最後に生成したコード:\n\`\`\`javascript\n${request.context.lastGeneratedCode.substring(0, 1000)}${request.context.lastGeneratedCode.length > 1000 ? '...(省略)' : ''}\n\`\`\``
      })
    }
    
    // クイックアクションボタン（ADMIN_DASHBOARD_URLが設定されている場合のみ）
    if (process.env.ADMIN_DASHBOARD_URL) {
      messages.push({
        type: 'template',
        altText: 'サポートアクション',
        template: {
          type: 'buttons',
          text: '対応アクション',
          actions: [
            {
              type: 'uri',
              label: '📊 ユーザー履歴確認',
              uri: `${process.env.ADMIN_DASHBOARD_URL}/users/${request.userId}`
            },
            {
              type: 'message',
              label: '✅ 対応開始',
              text: `/support start ${request.userId}`
            },
            {
              type: 'message',
              label: '📝 メモ追加',
              text: `/support note ${request.userId}`
            }
          ]
        }
      })
    } else {
      // URLが設定されていない場合はテキストメッセージのみ
      messages.push({
        type: 'text',
        text: `📋 対応用情報:\nユーザーID: ${request.userId}\n\n返信する場合は以下のコマンドを使用:\n/support reply ${request.userId} [メッセージ]`
      })
    }
    
    return messages
  }

  /**
   * ユーザーのコンテキストを取得
   */
  private async getUserContext(userId: string): Promise<any> {
    try {
      // 最新の生成コードを取得
      const { data: codes } = await (supabaseAdmin as any)
        .from('generated_codes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      // 最新のエラーログを取得
      const { data: errors } = await (supabaseAdmin as any)
        .from('error_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      // 会話履歴を取得
      const { data: conversations } = await (supabaseAdmin as any)
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('last_activity', { ascending: false })
        .limit(1)
      
      return {
        lastGeneratedCode: (codes as any)?.[0]?.generated_code,
        errorMessage: (errors as any)?.[0]?.error_message,
        conversationHistory: (conversations as any)?.[0]?.messages
      }
      
    } catch (error) {
      logger.error('Failed to get user context', { error, userId })
      return {}
    }
  }

  /**
   * サポートリクエストをDBに保存
   */
  private async saveSupportRequest(request: EngineerSupportRequest): Promise<void> {
    try {
      await (supabaseAdmin as any)
        .from('support_requests')
        .insert({
          user_id: request.userId,
          user_name: request.userName,
          message: request.userMessage,
          context: request.context,
          status: 'pending',
          created_at: request.timestamp
        })
    } catch (error) {
      logger.error('Failed to save support request', { error })
    }
  }

  /**
   * ユーザーの課金状況を取得
   */
  private async getUserSubscriptionStatus(userId: string): Promise<{ icon: string; text: string; isPremium: boolean }> {
    try {
      // ユーザー情報をDBから取得
      const { data: user, error } = await (supabaseAdmin as any)
        .from('users')
        .select('subscription_status, is_premium, subscription_end_date, monthly_usage_count')
        .eq('display_name', userId)
        .single()

      if (error || !user) {
        logger.warn('User not found in database', { userId })
        return {
          icon: '🆓',
          text: '無料ユーザー（未登録）',
          isPremium: false
        }
      }

      // プレミアムステータスを判定
      if (user.is_premium || user.subscription_status === 'premium') {
        // 有効期限をチェック
        if (user.subscription_end_date) {
          const endDate = new Date(user.subscription_end_date)
          const now = new Date()

          if (endDate > now) {
            const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            return {
              icon: '💎',
              text: `プレミアム会員（残り${daysRemaining}日）`,
              isPremium: true
            }
          } else {
            return {
              icon: '⏰',
              text: 'プレミアム期限切れ',
              isPremium: false
            }
          }
        }
        return {
          icon: '💎',
          text: 'プレミアム会員（無期限）',
          isPremium: true
        }
      }

      // 無料ユーザーの場合、使用回数も表示
      const usageCount = user.monthly_usage_count || 0
      const maxUsage = 10 // 無料枠の上限
      const remaining = Math.max(0, maxUsage - usageCount)

      return {
        icon: '🆓',
        text: `無料ユーザー（残り${remaining}回/月）`,
        isPremium: false
      }

    } catch (error) {
      logger.error('Failed to get user subscription status', { error, userId })
      return {
        icon: '❓',
        text: '確認エラー',
        isPremium: false
      }
    }
  }

  /**
   * 緊急度を判定
   */
  private isUrgent(request: EngineerSupportRequest): boolean {
    const urgentKeywords = ['緊急', 'エラー', '動かない', '助けて', 'バグ', '本番', 'production']
    const message = request.userMessage.toLowerCase()

    return urgentKeywords.some(keyword => message.includes(keyword))
  }

  /**
   * エンジニアからの返信を処理
   */
  async handleEngineerReply(
    engineerId: string,
    targetUserId: string,
    replyMessage: string
  ): Promise<void> {
    try {
      // エンジニアの認証確認
      if (!this.engineerUserIds.includes(engineerId)) {
        throw new Error('Unauthorized engineer')
      }
      
      // ユーザーに返信を送信
      await this.lineClient.pushMessage(targetUserId, [
        {
          type: 'text',
          text: `👨‍💻 エンジニアからの返信:\n\n${replyMessage}\n\n---\n何か追加のご質問があれば、お気軽にお聞きください。`
        }
      ])
      
      // サポートリクエストのステータスを更新
      await (supabaseAdmin as any)
        .from('support_requests')
        .update({ 
          status: 'responded',
          engineer_id: engineerId,
          response: replyMessage,
          responded_at: new Date()
        })
        .eq('user_id', targetUserId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
      
      logger.info('Engineer reply sent', { engineerId, targetUserId })
      
    } catch (error) {
      logger.error('Failed to handle engineer reply', { error })
      throw error
    }
  }
}

// シングルトンインスタンス
export const engineerSupport = new EngineerSupportSystem()