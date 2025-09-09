import { logger } from '@/lib/utils/logger'
import { LineApiClient } from '@/lib/line/client'
import EnvironmentValidator from '@/lib/config/environment'

/**
 * アラート通知システム
 * エラーや警告を管理者に通知
 */
export class AlertNotifier {
  private static instance: AlertNotifier | null = null
  private lineClient: LineApiClient | null = null
  private adminLineId: string | null = null
  private alertHistory: Map<string, number> = new Map()
  private readonly ALERT_THROTTLE_MS = 300000 // 5分間は同じアラートを送らない
  
  private constructor() {
    // LINE通知の設定
    const adminId = EnvironmentValidator.getOptional('ADMIN_LINE_USER_ID', '')
    if (adminId) {
      this.adminLineId = adminId
      this.lineClient = new LineApiClient()
    }
  }
  
  static getInstance(): AlertNotifier {
    if (!this.instance) {
      this.instance = new AlertNotifier()
    }
    return this.instance
  }
  
  /**
   * 重大なアラートを送信
   */
  async sendCriticalAlert(
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.sendAlert('critical', title, message, context)
  }
  
  /**
   * 警告アラートを送信
   */
  async sendWarningAlert(
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.sendAlert('warning', title, message, context)
  }
  
  /**
   * 情報アラートを送信
   */
  async sendInfoAlert(
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    await this.sendAlert('info', title, message, context)
  }
  
  /**
   * アラート送信の実装
   */
  private async sendAlert(
    level: 'critical' | 'warning' | 'info',
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    // アラートキーでスロットリング
    const alertKey = `${level}:${title}`
    const lastSent = this.alertHistory.get(alertKey)
    const now = Date.now()
    
    if (lastSent && now - lastSent < this.ALERT_THROTTLE_MS) {
      logger.debug('Alert throttled', { alertKey, timeSinceLastAlert: now - lastSent })
      return
    }
    
    // ログ出力
    const logData = {
      level,
      title,
      message,
      context,
      timestamp: new Date().toISOString()
    }
    
    switch (level) {
      case 'critical':
        logger.error('CRITICAL ALERT', logData)
        break
      case 'warning':
        logger.warn('WARNING ALERT', logData)
        break
      case 'info':
        logger.info('INFO ALERT', logData)
        break
    }
    
    // LINE通知
    if (this.lineClient && this.adminLineId) {
      await this.sendLineNotification(level, title, message, context)
    }
    
    // Slack通知（環境変数があれば）
    const slackWebhook = EnvironmentValidator.getOptional('SLACK_WEBHOOK_URL', '')
    if (slackWebhook) {
      await this.sendSlackNotification(slackWebhook, level, title, message, context)
    }
    
    // アラート履歴を更新
    this.alertHistory.set(alertKey, now)
    
    // 古い履歴を削除
    this.cleanupAlertHistory()
  }
  
  /**
   * LINE通知を送信
   */
  private async sendLineNotification(
    level: string,
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const emoji = {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️'
      }[level] || '📢'
      
      let text = `${emoji} ${title}\n\n${message}`
      
      if (context) {
        const contextStr = JSON.stringify(context, null, 2)
        if (contextStr.length < 500) {
          text += `\n\n詳細:\n${contextStr}`
        }
      }
      
      // LINEの文字数制限
      if (text.length > 2000) {
        text = text.substring(0, 1997) + '...'
      }
      
      await this.lineClient!.pushMessage(this.adminLineId!, [{
        type: 'text',
        text
      }])
      
    } catch (error) {
      logger.error('Failed to send LINE notification', { error })
    }
  }
  
  /**
   * Slack通知を送信
   */
  private async sendSlackNotification(
    webhookUrl: string,
    level: string,
    title: string,
    message: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const color = {
        critical: 'danger',
        warning: 'warning',
        info: 'good'
      }[level] || 'default'
      
      const payload = {
        attachments: [{
          color,
          title,
          text: message,
          fields: context ? Object.entries(context).map(([key, value]) => ({
            title: key,
            value: String(value),
            short: true
          })) : [],
          footer: 'GAS Generator Alert',
          ts: Math.floor(Date.now() / 1000)
        }]
      }
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      
      if (!response.ok) {
        logger.error('Slack notification failed', { 
          status: response.status, 
          statusText: response.statusText 
        })
      }
      
    } catch (error) {
      logger.error('Failed to send Slack notification', { error })
    }
  }
  
  /**
   * 古いアラート履歴を削除
   */
  private cleanupAlertHistory(): void {
    const now = Date.now()
    const cutoff = now - 3600000 // 1時間以上前
    
    for (const [key, timestamp] of this.alertHistory.entries()) {
      if (timestamp < cutoff) {
        this.alertHistory.delete(key)
      }
    }
  }
  
  /**
   * システムメトリクスアラート
   */
  async checkSystemMetrics(metrics: {
    memoryUsage?: number
    cpuUsage?: number
    errorRate?: number
    responseTime?: number
    queueLength?: number
  }): Promise<void> {
    // メモリ使用率チェック
    if (metrics.memoryUsage && metrics.memoryUsage > 90) {
      await this.sendCriticalAlert(
        'メモリ使用率が危険域',
        `メモリ使用率が${metrics.memoryUsage}%に達しています`,
        { memoryUsage: metrics.memoryUsage }
      )
    } else if (metrics.memoryUsage && metrics.memoryUsage > 80) {
      await this.sendWarningAlert(
        'メモリ使用率が高い',
        `メモリ使用率が${metrics.memoryUsage}%に達しています`,
        { memoryUsage: metrics.memoryUsage }
      )
    }
    
    // エラー率チェック
    if (metrics.errorRate && metrics.errorRate > 5) {
      await this.sendCriticalAlert(
        'エラー率が高い',
        `エラー率が${metrics.errorRate}%に達しています`,
        { errorRate: metrics.errorRate }
      )
    }
    
    // レスポンスタイムチェック
    if (metrics.responseTime && metrics.responseTime > 5000) {
      await this.sendWarningAlert(
        'レスポンスタイムが遅い',
        `平均レスポンスタイムが${metrics.responseTime}msです`,
        { responseTime: metrics.responseTime }
      )
    }
    
    // キュー長チェック
    if (metrics.queueLength && metrics.queueLength > 100) {
      await this.sendWarningAlert(
        'キューが詰まっています',
        `処理待ちキューが${metrics.queueLength}件あります`,
        { queueLength: metrics.queueLength }
      )
    }
  }
  
  /**
   * Vision API使用量アラート
   */
  async checkVisionUsage(usage: {
    current: number
    limit: number
    percentage: number
  }): Promise<void> {
    if (usage.percentage >= 90) {
      await this.sendCriticalAlert(
        'Vision API使用量が限界に近い',
        `Vision APIの使用量が月間上限の${usage.percentage}%に達しています`,
        usage
      )
    } else if (usage.percentage >= 80) {
      await this.sendWarningAlert(
        'Vision API使用量が多い',
        `Vision APIの使用量が月間上限の${usage.percentage}%に達しています`,
        usage
      )
    }
  }
  
  /**
   * 決済エラーアラート
   */
  async notifyPaymentError(error: {
    userId: string
    errorType: string
    message: string
    amount?: number
  }): Promise<void> {
    await this.sendCriticalAlert(
      '決済エラー',
      `ユーザー${error.userId}の決済でエラーが発生しました: ${error.message}`,
      error
    )
  }
  
  /**
   * セキュリティアラート
   */
  async notifySecurityAlert(alert: {
    type: string
    ip?: string
    userId?: string
    details: string
  }): Promise<void> {
    await this.sendCriticalAlert(
      `セキュリティアラート: ${alert.type}`,
      alert.details,
      { ip: alert.ip, userId: alert.userId }
    )
  }
}

// シングルトンインスタンスをエクスポート
export const alertNotifier = AlertNotifier.getInstance()