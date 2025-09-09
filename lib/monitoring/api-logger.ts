/**
 * APIリクエストロギング・監視システム
 * リクエスト/レスポンスの記録と分析
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { requestContext } from '@/lib/utils/request-context'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { SecureRandom } from '@/lib/utils/secure-random'

interface ApiLogEntry {
  requestId: string
  timestamp: Date
  method: string
  path: string
  query: Record<string, any>
  headers: Record<string, string>
  body?: any
  userId?: string
  sessionId?: string
  ip: string
  userAgent?: string
  responseStatus: number
  responseTime: number
  error?: {
    message: string
    stack?: string
    code?: string
  }
  metadata?: Record<string, any>
}

interface ApiMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerMinute: number
  errorRate: number
  statusCodeDistribution: Record<number, number>
  endpointMetrics: Map<string, EndpointMetrics>
}

interface EndpointMetrics {
  path: string
  method: string
  totalCalls: number
  successCount: number
  errorCount: number
  averageResponseTime: number
  lastCalled: Date
  errorTypes: Map<string, number>
}

export class ApiLogger {
  private static instance: ApiLogger | null = null
  private logs: ApiLogEntry[] = []
  private metrics: ApiMetrics = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    p95ResponseTime: 0,
    p99ResponseTime: 0,
    requestsPerMinute: 0,
    errorRate: 0,
    statusCodeDistribution: {},
    endpointMetrics: new Map()
  }
  private responseTimes: number[] = []
  private metricsWindow = 60 * 1000 // 1分間のウィンドウ
  private maxLogsInMemory = 1000
  private cleanupInterval?: NodeJS.Timeout

  private constructor() {
    this.startCleanup()
  }

  static getInstance(): ApiLogger {
    if (!this.instance) {
      this.instance = new ApiLogger()
    }
    return this.instance
  }

  /**
   * APIリクエストのログ開始
   */
  startRequest(req: NextRequest): string {
    const requestId = this.generateRequestId()
    const startTime = Date.now()

    // パフォーマンス計測開始
    performanceMonitor.startTimer(`api.${requestId}`)

    // リクエストコンテキストに保存
    requestContext.mergeContext({
      requestId,
      startTime,
      path: new URL(req.url).pathname,
      method: req.method
    })

    return requestId
  }

  /**
   * APIリクエストのログ記録
   */
  async logRequest(
    req: NextRequest,
    res: NextResponse,
    requestId: string,
    options: {
      userId?: string
      sessionId?: string
      error?: Error
      metadata?: Record<string, any>
    } = {}
  ): Promise<void> {
    const endTime = Date.now()
    const startTime = requestContext.getContext()?.startTime || endTime
    const responseTime = endTime - startTime
    const url = new URL(req.url)
    const path = url.pathname

    // レスポンスタイムの記録
    this.responseTimes.push(responseTime)
    if (this.responseTimes.length > 10000) {
      this.responseTimes = this.responseTimes.slice(-10000)
    }

    // ログエントリの作成
    const logEntry: ApiLogEntry = {
      requestId,
      timestamp: new Date(),
      method: req.method,
      path,
      query: Object.fromEntries(url.searchParams),
      headers: this.sanitizeHeaders(req.headers),
      body: await this.sanitizeBody(req),
      userId: options.userId,
      sessionId: options.sessionId,
      ip: this.getClientIp(req),
      userAgent: req.headers.get('user-agent') || undefined,
      responseStatus: res.status,
      responseTime,
      metadata: options.metadata
    }

    // エラー情報の追加
    if (options.error) {
      logEntry.error = {
        message: options.error.message,
        code: (options.error as any).code,
        stack: process.env.NODE_ENV !== 'production' 
          ? options.error.stack?.split('\n').slice(0, 5).join('\n')
          : undefined
      }
    }

    // ログの保存
    this.logs.push(logEntry)
    if (this.logs.length > this.maxLogsInMemory) {
      this.logs.shift()
    }

    // メトリクスの更新
    this.updateMetrics(logEntry)

    // 構造化ログ出力
    const logLevel = res.status >= 500 ? 'error' : 
                    res.status >= 400 ? 'warn' : 'info'
    
    logger[logLevel]('API Request', {
      requestId,
      method: req.method,
      path,
      status: res.status,
      responseTime,
      userId: options.userId,
      ip: logEntry.ip,
      error: logEntry.error?.message
    })

    // パフォーマンス計測終了
    performanceMonitor.endTimer(`api.${requestId}`, {
      path,
      method: req.method,
      status: res.status
    })

    // 異常検知
    this.detectAnomalies(logEntry)
  }

  /**
   * ヘッダーのサニタイズ
   */
  private sanitizeHeaders(headers: Headers): Record<string, string> {
    const sanitized: Record<string, string> = {}
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
      'x-csrf-token'
    ]

    headers.forEach((value, key) => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]'
      } else {
        sanitized[key] = value.substring(0, 1000) // 長さ制限
      }
    })

    return sanitized
  }

  /**
   * ボディのサニタイズ
   */
  private async sanitizeBody(req: NextRequest): Promise<any> {
    try {
      // ボディサイズの制限
      const contentLength = parseInt(req.headers.get('content-length') || '0')
      if (contentLength > 10000) {
        return '[BODY TOO LARGE]'
      }

      // Content-Typeのチェック
      const contentType = req.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        return '[NON-JSON BODY]'
      }

      // JSONパース（クローンを使用）
      const clonedReq = req.clone()
      const body = await clonedReq.json().catch(() => null)
      
      if (!body) return null

      // 機密情報の除去
      return this.removeSensitiveData(body)
    } catch {
      return null
    }
  }

  /**
   * 機密情報の除去
   */
  private removeSensitiveData(obj: any): any {
    if (!obj || typeof obj !== 'object') return obj

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'api_key',
      'creditCard',
      'credit_card',
      'ssn',
      'socialSecurityNumber'
    ]

    const cleaned = Array.isArray(obj) ? [] : {}

    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue

      const lowerKey = key.toLowerCase()
      if (sensitiveKeys.some(k => lowerKey.includes(k.toLowerCase()))) {
        (cleaned as any)[key] = '[REDACTED]'
      } else if (typeof obj[key] === 'object') {
        (cleaned as any)[key] = this.removeSensitiveData(obj[key])
      } else {
        (cleaned as any)[key] = obj[key]
      }
    }

    return cleaned
  }

  /**
   * クライアントIPの取得
   */
  private getClientIp(req: NextRequest): string {
    return req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
           req.headers.get('x-real-ip') ||
           req.headers.get('cf-connecting-ip') ||
           req.ip ||
           'unknown'
  }

  /**
   * メトリクスの更新
   */
  private updateMetrics(logEntry: ApiLogEntry): void {
    // 基本メトリクス
    this.metrics.totalRequests++
    
    if (logEntry.responseStatus < 400) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }

    // レスポンスタイムの更新
    const totalTime = this.responseTimes.reduce((a, b) => a + b, 0)
    this.metrics.averageResponseTime = totalTime / this.responseTimes.length

    // パーセンタイルの計算
    const sorted = [...this.responseTimes].sort((a, b) => a - b)
    this.metrics.p95ResponseTime = sorted[Math.floor(sorted.length * 0.95)] || 0
    this.metrics.p99ResponseTime = sorted[Math.floor(sorted.length * 0.99)] || 0

    // ステータスコード分布
    this.metrics.statusCodeDistribution[logEntry.responseStatus] = 
      (this.metrics.statusCodeDistribution[logEntry.responseStatus] || 0) + 1

    // エラー率
    this.metrics.errorRate = this.metrics.failedRequests / this.metrics.totalRequests

    // エンドポイント別メトリクス
    const endpointKey = `${logEntry.method} ${logEntry.path}`
    let endpointMetrics = this.metrics.endpointMetrics.get(endpointKey)
    
    if (!endpointMetrics) {
      endpointMetrics = {
        path: logEntry.path,
        method: logEntry.method,
        totalCalls: 0,
        successCount: 0,
        errorCount: 0,
        averageResponseTime: 0,
        lastCalled: new Date(),
        errorTypes: new Map()
      }
      this.metrics.endpointMetrics.set(endpointKey, endpointMetrics)
    }

    endpointMetrics.totalCalls++
    if (logEntry.responseStatus < 400) {
      endpointMetrics.successCount++
    } else {
      endpointMetrics.errorCount++
      if (logEntry.error) {
        const errorType = logEntry.error.code || 'UNKNOWN'
        endpointMetrics.errorTypes.set(
          errorType,
          (endpointMetrics.errorTypes.get(errorType) || 0) + 1
        )
      }
    }
    
    // 移動平均でレスポンスタイムを更新
    endpointMetrics.averageResponseTime = 
      (endpointMetrics.averageResponseTime * (endpointMetrics.totalCalls - 1) + 
       logEntry.responseTime) / endpointMetrics.totalCalls
    
    endpointMetrics.lastCalled = new Date()
  }

  /**
   * 異常検知
   */
  private detectAnomalies(logEntry: ApiLogEntry): void {
    // レスポンスタイムの異常
    if (logEntry.responseTime > this.metrics.averageResponseTime * 3) {
      logger.warn('Slow API response detected', {
        requestId: logEntry.requestId,
        path: logEntry.path,
        responseTime: logEntry.responseTime,
        average: this.metrics.averageResponseTime
      })
    }

    // 連続エラーの検知
    const recentLogs = this.logs.slice(-10)
    const recentErrors = recentLogs.filter(l => l.responseStatus >= 500).length
    if (recentErrors >= 5) {
      logger.error('High error rate detected', {
        recentErrors,
        totalRecent: recentLogs.length
      })
    }

    // 特定IPからの異常アクセス
    const ipLogs = this.logs.filter(l => 
      l.ip === logEntry.ip && 
      l.timestamp.getTime() > Date.now() - 60000
    )
    if (ipLogs.length > 100) {
      logger.warn('Potential DoS attack detected', {
        ip: logEntry.ip,
        requestCount: ipLogs.length
      })
    }
  }

  /**
   * メトリクスの取得
   */
  getMetrics(): ApiMetrics {
    // リクエスト/分の計算
    const now = Date.now()
    const recentLogs = this.logs.filter(l => 
      l.timestamp.getTime() > now - this.metricsWindow
    )
    this.metrics.requestsPerMinute = recentLogs.length

    return { ...this.metrics }
  }

  /**
   * エンドポイント別メトリクスの取得
   */
  getEndpointMetrics(path?: string, method?: string): EndpointMetrics[] {
    const metrics = Array.from(this.metrics.endpointMetrics.values())
    
    if (path) {
      return metrics.filter(m => m.path === path && (!method || m.method === method))
    }
    
    return metrics
  }

  /**
   * ログの検索
   */
  searchLogs(filters: {
    startTime?: Date
    endTime?: Date
    userId?: string
    sessionId?: string
    path?: string
    method?: string
    status?: number
    minResponseTime?: number
    hasError?: boolean
  }): ApiLogEntry[] {
    return this.logs.filter(log => {
      if (filters.startTime && log.timestamp < filters.startTime) return false
      if (filters.endTime && log.timestamp > filters.endTime) return false
      if (filters.userId && log.userId !== filters.userId) return false
      if (filters.sessionId && log.sessionId !== filters.sessionId) return false
      if (filters.path && !log.path.includes(filters.path)) return false
      if (filters.method && log.method !== filters.method) return false
      if (filters.status && log.responseStatus !== filters.status) return false
      if (filters.minResponseTime && log.responseTime < filters.minResponseTime) return false
      if (filters.hasError !== undefined && !!log.error !== filters.hasError) return false
      
      return true
    })
  }

  /**
   * リクエストIDの生成
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${SecureRandom.generateString(9)}`
  }

  /**
   * 定期クリーンアップ
   */
  private startCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - 3600000 // 1時間以上前
      this.logs = this.logs.filter(l => l.timestamp.getTime() > cutoff)
      
      // 古いエンドポイントメトリクスの削除
      for (const [key, metrics] of this.metrics.endpointMetrics) {
        if (metrics.lastCalled.getTime() < cutoff) {
          this.metrics.endpointMetrics.delete(key)
        }
      }
    }, 300000) // 5分ごと
  }

  /**
   * シャットダウン
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = undefined
    }
  }
}

export const apiLogger = ApiLogger.getInstance()

/**
 * APIロギングミドルウェア
 */
export function apiLoggingMiddleware() {
  return async (req: NextRequest) => {
    const requestId = apiLogger.startRequest(req)
    
    // レスポンスをインターセプト
    const response = NextResponse.next()
    
    // ログ記録（非同期）
    setImmediate(() => {
      apiLogger.logRequest(req, response, requestId).catch(err => {
        logger.error('Failed to log API request', { error: err })
      })
    })
    
    // リクエストIDをヘッダーに追加
    response.headers.set('X-Request-Id', requestId)
    
    return response
  }
}