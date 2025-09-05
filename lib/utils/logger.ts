// 構造化ログシステム
// Vercelの標準出力に最適化

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  [key: string]: any
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  requestId?: string
}

class Logger {
  private logLevel: LogLevel

  constructor() {
    this.logLevel = (process.env.LOG_LEVEL as LogLevel) || 'info'
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }

    return levels[level] >= levels[this.logLevel]
  }

  private formatLogEntry(level: LogLevel, message: string, context?: LogContext): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ? this.sanitizeContext(context) : undefined
    }

    // Vercel用のJSON形式で出力
    return JSON.stringify(entry)
  }

  // 機密情報をマスキング
  private sanitizeContext(context: LogContext): LogContext {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization']
    const sanitized = { ...context }

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }

  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    console.log(this.formatLogEntry('debug', message, context))
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    console.log(this.formatLogEntry('info', message, context))
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return
    console.warn(this.formatLogEntry('warn', message, context))
  }

  error(message: string, context?: LogContext): void {
    if (!this.shouldLog('error')) return
    console.error(this.formatLogEntry('error', message, context))
  }

  // リクエスト用の特別メソッド
  request(message: string, requestId: string, context?: LogContext): void {
    this.info(message, { ...context, requestId })
  }

  // パフォーマンス測定用
  time(label: string): void {
    console.time(label)
  }

  timeEnd(label: string): void {
    console.timeEnd(label)
  }
}

export const logger = new Logger()

// Express/Next.js middleware用のログ関数
export function logWebhookRequest(
  method: string,
  path: string,
  duration: number,
  statusCode: number,
  requestId: string,
  userAgent?: string
): void {
  logger.info('Webhook request processed', {
    method,
    path,
    duration,
    statusCode,
    requestId,
    userAgent
  })
}