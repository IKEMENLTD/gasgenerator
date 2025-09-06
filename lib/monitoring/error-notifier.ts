import { logger } from '@/lib/utils/logger'
import { AppError, ErrorCode } from '@/lib/errors/app-error'
import { LineApiClient } from '@/lib/line/client'

interface ErrorNotification {
  id: string
  timestamp: number
  error: {
    message: string
    code?: string
    stack?: string
  }
  context?: Record<string, any>
  severity: 'low' | 'medium' | 'high' | 'critical'
  notified: boolean
}

interface NotificationConfig {
  enableLineNotification?: boolean
  adminLineUserId?: string
  minSeverity?: 'low' | 'medium' | 'high' | 'critical'
  throttleMs?: number
  maxNotificationsPerHour?: number
}

export class ErrorNotifier {
  private static instance: ErrorNotifier | null = null
  private errors: Map<string, ErrorNotification> = new Map()
  private notificationHistory: ErrorNotification[] = []
  private config: NotificationConfig
  private lineClient?: LineApiClient
  private lastNotificationTime: Map<string, number> = new Map()
  private hourlyNotificationCount = 0
  private hourlyCountResetTime = Date.now() + 3600000

  private readonly MAX_HISTORY = 100
  private readonly ERROR_PATTERNS = new Map<RegExp, 'critical' | 'high' | 'medium' | 'low'>([
    [/database.*connection/i, 'critical'],
    [/out of memory/i, 'critical'],
    [/deadlock/i, 'critical'],
    [/authentication.*failed/i, 'high'],
    [/rate limit/i, 'medium'],
    [/timeout/i, 'medium'],
    [/validation error/i, 'low']
  ])

  private constructor(config: NotificationConfig = {}) {
    this.config = {
      enableLineNotification: false,
      minSeverity: 'high',
      throttleMs: 300000, // 5分
      maxNotificationsPerHour: 20,
      ...config
    }

    if (this.config.enableLineNotification && this.config.adminLineUserId) {
      this.lineClient = new LineApiClient()
    }

    this.startCleanup()
  }

  static getInstance(config?: NotificationConfig): ErrorNotifier {
    if (!this.instance) {
      this.instance = new ErrorNotifier(config)
    }
    return this.instance
  }

  /**
   * エラーの報告
   */
  async reportError(
    error: unknown,
    context?: Record<string, any>
  ): Promise<void> {
    const notification = this.createNotification(error, context)
    
    // 重複チェック
    const errorKey = this.getErrorKey(notification)
    const existing = this.errors.get(errorKey)
    
    if (existing && Date.now() - existing.timestamp < 60000) {
      // 1分以内の重複は無視
      logger.debug('Duplicate error ignored', { errorKey })
      return
    }

    this.errors.set(errorKey, notification)
    this.notificationHistory.push(notification)
    
    // 履歴サイズ制限
    if (this.notificationHistory.length > this.MAX_HISTORY) {
      this.notificationHistory.shift()
    }

    // ログ出力
    this.logError(notification)

    // 通知判定
    if (this.shouldNotify(notification)) {
      await this.sendNotification(notification)
    }

    // メトリクス更新
    this.updateMetrics(notification)
  }

  /**
   * 通知の作成
   */
  private createNotification(
    error: unknown,
    context?: Record<string, any>
  ): ErrorNotification {
    const id = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const severity = this.determineSeverity(error)

    let errorInfo: ErrorNotification['error']
    
    if (error instanceof AppError) {
      errorInfo = {
        message: error.message,
        code: error.code,
        stack: error.stack
      }
    } else if (error instanceof Error) {
      errorInfo = {
        message: error.message,
        stack: error.stack
      }
    } else {
      errorInfo = {
        message: String(error)
      }
    }

    return {
      id,
      timestamp: Date.now(),
      error: errorInfo,
      context,
      severity,
      notified: false
    }
  }

  /**
   * 重要度の判定
   */
  private determineSeverity(error: unknown): ErrorNotification['severity'] {
    // AppErrorの場合
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.INTERNAL_ERROR:
        case ErrorCode.DATABASE_ERROR:
          return 'critical'
        case ErrorCode.UNAUTHORIZED:
        case ErrorCode.SERVICE_UNAVAILABLE:
          return 'high'
        case ErrorCode.RATE_LIMIT_EXCEEDED:
        case ErrorCode.EXTERNAL_API_ERROR:
          return 'medium'
        default:
          return 'low'
      }
    }

    // パターンマッチング
    const errorMessage = error instanceof Error ? error.message : String(error)
    for (const [pattern, severity] of this.ERROR_PATTERNS.entries()) {
      if (pattern.test(errorMessage)) {
        return severity
      }
    }

    // デフォルト
    return 'medium'
  }

  /**
   * エラーキーの生成（重複検出用）
   */
  private getErrorKey(notification: ErrorNotification): string {
    const { error } = notification
    return `${error.code || 'unknown'}_${error.message.substring(0, 50)}`
  }

  /**
   * ログ出力
   */
  private logError(notification: ErrorNotification): void {
    const logData = {
      id: notification.id,
      severity: notification.severity,
      error: notification.error.message,
      code: notification.error.code,
      context: notification.context
    }

    switch (notification.severity) {
      case 'critical':
      case 'high':
        logger.error('Critical error reported', logData)
        break
      case 'medium':
        logger.warn('Error reported', logData)
        break
      case 'low':
        logger.info('Minor error reported', logData)
        break
    }
  }

  /**
   * 通知すべきか判定
   */
  private shouldNotify(notification: ErrorNotification): boolean {
    if (!this.config.enableLineNotification) {
      return false
    }

    // 重要度チェック
    const severityLevels = { low: 0, medium: 1, high: 2, critical: 3 }
    if (severityLevels[notification.severity] < severityLevels[this.config.minSeverity!]) {
      return false
    }

    // 時間制限チェック
    const now = Date.now()
    if (now > this.hourlyCountResetTime) {
      this.hourlyNotificationCount = 0
      this.hourlyCountResetTime = now + 3600000
    }

    if (this.hourlyNotificationCount >= this.config.maxNotificationsPerHour!) {
      logger.warn('Notification limit reached', {
        count: this.hourlyNotificationCount,
        limit: this.config.maxNotificationsPerHour
      })
      return false
    }

    // スロットルチェック
    const errorKey = this.getErrorKey(notification)
    const lastNotified = this.lastNotificationTime.get(errorKey)
    if (lastNotified && now - lastNotified < this.config.throttleMs!) {
      return false
    }

    return true
  }

  /**
   * 通知の送信
   */
  private async sendNotification(notification: ErrorNotification): Promise<void> {
    if (!this.lineClient || !this.config.adminLineUserId) {
      return
    }

    try {
      const message = this.formatNotificationMessage(notification)
      
      await this.lineClient.pushMessage(this.config.adminLineUserId, {
        type: 'text',
        text: message
      })

      notification.notified = true
      this.hourlyNotificationCount++
      this.lastNotificationTime.set(this.getErrorKey(notification), Date.now())

      logger.info('Error notification sent', {
        notificationId: notification.id,
        severity: notification.severity
      })
    } catch (error) {
      logger.error('Failed to send error notification', { error })
    }
  }

  /**
   * 通知メッセージのフォーマット
   */
  private formatNotificationMessage(notification: ErrorNotification): string {
    const emoji = {
      critical: '🚨',
      high: '⚠️',
      medium: '⚡',
      low: 'ℹ️'
    }[notification.severity]

    const time = new Date(notification.timestamp).toLocaleString('ja-JP')

    let message = `${emoji} エラー通知 [${notification.severity.toUpperCase()}]\n`
    message += `\n時刻: ${time}\n`
    message += `\nエラー: ${notification.error.message}\n`
    
    if (notification.error.code) {
      message += `コード: ${notification.error.code}\n`
    }

    if (notification.context) {
      const contextStr = JSON.stringify(notification.context, null, 2)
      if (contextStr.length < 200) {
        message += `\nコンテキスト:\n${contextStr}`
      }
    }

    // LINE最大文字数制限
    if (message.length > 2000) {
      message = message.substring(0, 1997) + '...'
    }

    return message
  }

  /**
   * メトリクス更新
   */
  private updateMetrics(notification: ErrorNotification): void {
    // ここで外部監視サービスにメトリクスを送信することも可能
    // 例: Datadog, New Relic, CloudWatch等
  }

  /**
   * エラーサマリーの取得
   */
  getErrorSummary(timeWindow?: number): {
    total: number
    bySeverity: Record<string, number>
    byCode: Record<string, number>
    recentErrors: ErrorNotification[]
  } {
    const now = Date.now()
    const cutoff = timeWindow ? now - timeWindow : 0
    
    const relevantErrors = this.notificationHistory.filter(
      n => n.timestamp >= cutoff
    )

    const bySeverity: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    }

    const byCode: Record<string, number> = {}

    for (const error of relevantErrors) {
      bySeverity[error.severity]++
      const code = error.error.code || 'unknown'
      byCode[code] = (byCode[code] || 0) + 1
    }

    return {
      total: relevantErrors.length,
      bySeverity,
      byCode,
      recentErrors: relevantErrors.slice(-10)
    }
  }

  /**
   * 定期クリーンアップ
   */
  private startCleanup(): void {
    setInterval(() => {
      const cutoff = Date.now() - 3600000 // 1時間
      
      // 古いエラーを削除
      for (const [key, error] of this.errors.entries()) {
        if (error.timestamp < cutoff) {
          this.errors.delete(key)
        }
      }

      // 通知履歴の整理
      this.notificationHistory = this.notificationHistory.filter(
        n => n.timestamp >= cutoff
      )
    }, 600000) // 10分ごと
  }

  /**
   * 設定の更新
   */
  updateConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config }
    
    if (this.config.enableLineNotification && 
        this.config.adminLineUserId && 
        !this.lineClient) {
      this.lineClient = new LineApiClient()
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.errors.clear()
    this.notificationHistory = []
    this.lastNotificationTime.clear()
    ErrorNotifier.instance = null
  }
}

export const errorNotifier = ErrorNotifier.getInstance()