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
  private static instance: Logger | null = null

  constructor() {
    this.logLevel = this.getLogLevel()
  }

  static getInstance(): Logger {
    if (!this.instance) {
      this.instance = new Logger()
    }
    return this.instance
  }

  private getLogLevel(): LogLevel {
    const level = process.env.LOG_LEVEL?.toLowerCase()
    const validLevels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    
    if (level && validLevels.includes(level as LogLevel)) {
      return level as LogLevel
    }
    
    // デフォルトは環境に応じて設定
    return process.env.NODE_ENV === 'production' ? 'info' : 'debug'
  }

  setLogLevel(level: LogLevel): void {
    this.logLevel = level
  }

  getLevel(): LogLevel {
    return this.logLevel
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
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'authorization', 'api_key', 'apikey', 'auth']
    const sanitized = this.deepClone(context)

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]'
      }
    }

    return sanitized
  }

  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime())
    if (obj instanceof Array) return obj.map(item => this.deepClone(item))
    
    const cloned: any = {}
    for (const key in obj) {
      cloned[key] = this.deepClone(obj[key])
    }
    return cloned
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

export const logger = Logger.getInstance()

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