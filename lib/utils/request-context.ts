import { AsyncLocalStorage } from 'async_hooks'
import { logger } from '@/lib/utils/logger'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { SecureRandom } from '@/lib/utils/secure-random'

export interface RequestContext {
  requestId: string
  userId?: string
  sessionId?: string
  ipAddress?: string
  userAgent?: string
  path: string
  method: string
  startTime: number
  traceId?: string
  spanId?: string
  tags: Map<string, string>
  metrics: Map<string, number>
}

class RequestContextManager {
  private static instance: RequestContextManager | null = null
  private storage: AsyncLocalStorage<RequestContext>

  private constructor() {
    // AsyncLocalStorageはNode.js環境でのみ利用可能
    if (typeof window === 'undefined') {
      this.storage = new AsyncLocalStorage<RequestContext>()
    } else {
      // ブラウザ環境では簡易的な実装
      this.storage = {
        getStore: () => undefined,
        run: (store: any, callback: any) => callback(),
        enterWith: () => {},
        disable: () => {},
        exit: () => {}
      } as any
    }
  }

  static getInstance(): RequestContextManager {
    if (!this.instance) {
      this.instance = new RequestContextManager()
    }
    return this.instance
  }

  /**
   * リクエストコンテキストの作成と実行
   */
  async runWithContext<T>(
    context: Partial<RequestContext>,
    callback: () => Promise<T>
  ): Promise<T> {
    const fullContext: RequestContext = {
      requestId: context.requestId || this.generateRequestId(),
      path: context.path || '',
      method: context.method || 'GET',
      startTime: Date.now(),
      tags: new Map(),
      metrics: new Map(),
      ...context
    }

    // トレーシング情報の生成
    if (!fullContext.traceId) {
      fullContext.traceId = this.generateTraceId()
    }
    if (!fullContext.spanId) {
      fullContext.spanId = this.generateSpanId()
    }

    // パフォーマンス計測開始
    performanceMonitor.startTimer(`request.${fullContext.requestId}`)

    try {
      // コンテキスト内で実行
      const result = await this.storage.run(fullContext, callback)
      
      // 成功メトリクス
      this.recordMetric('success', 1)
      
      return result
    } catch (error) {
      // エラーメトリクス
      this.recordMetric('error', 1)
      throw error
    } finally {
      // パフォーマンス計測終了
      const duration = performanceMonitor.endTimer(`request.${fullContext.requestId}`, {
        path: fullContext.path,
        method: fullContext.method,
        userId: fullContext.userId
      })

      // リクエスト完了ログ
      this.logRequestCompletion(fullContext, duration)
    }
  }

  /**
   * 現在のコンテキストを取得
   */
  getContext(): RequestContext | undefined {
    return this.storage.getStore()
  }

  /**
   * 現在のリクエストIDを取得
   */
  getRequestId(): string | undefined {
    return this.getContext()?.requestId
  }

  /**
   * 現在のユーザーIDを取得
   */
  getUserId(): string | undefined {
    return this.getContext()?.userId
  }

  /**
   * タグの追加
   */
  addTag(key: string, value: string): void {
    const context = this.getContext()
    if (context) {
      context.tags.set(key, value)
    }
  }

  /**
   * メトリクスの記録
   */
  recordMetric(name: string, value: number): void {
    const context = this.getContext()
    if (context) {
      const current = context.metrics.get(name) || 0
      context.metrics.set(name, current + value)
    }
  }

  /**
   * コンテキストのマージ（プロトタイプ汚染対策済み）
   */
  mergeContext(updates: Partial<RequestContext>): void {
    const context = this.getContext()
    if (context && updates && typeof updates === 'object') {
      // プロトタイプ汚染対策：安全なプロパティのみコピー
      const safeKeys = ['requestId', 'traceId', 'spanId', 'method', 'path', 'ip', 'userAgent']
      
      for (const key of safeKeys) {
        if (key in updates && !key.includes('__proto__') && !key.includes('constructor') && !key.includes('prototype')) {
          const value = updates[key as keyof RequestContext]
          if (value !== undefined && value !== null) {
            (context as any)[key] = value
          }
        }
      }
      
      // MapやDateなどの特殊なプロパティは個別に処理
      if (updates.tags && updates.tags instanceof Map) {
        updates.tags.forEach((value, key) => {
          if (!key.includes('__proto__') && !key.includes('constructor')) {
            context.tags.set(key, value)
          }
        })
      }
      
      if (updates.metrics && updates.metrics instanceof Map) {
        updates.metrics.forEach((value, key) => {
          if (!key.includes('__proto__') && !key.includes('constructor')) {
            context.metrics.set(key, value)
          }
        })
      }
    }
  }

  /**
   * 子スパンの作成
   */
  async withSpan<T>(
    name: string,
    callback: () => Promise<T>
  ): Promise<T> {
    const parentContext = this.getContext()
    if (!parentContext) {
      return callback()
    }

    const spanContext: RequestContext = {
      ...parentContext,
      spanId: this.generateSpanId(),
      tags: new Map(parentContext.tags),
      metrics: new Map()
    }

    // スパン名をタグに追加
    spanContext.tags.set('span.name', name)

    performanceMonitor.startTimer(`span.${spanContext.spanId}`)

    try {
      const result = await this.storage.run(spanContext, callback)
      return result
    } finally {
      const duration = performanceMonitor.endTimer(`span.${spanContext.spanId}`)
      
      logger.debug('Span completed', {
        requestId: spanContext.requestId,
        traceId: spanContext.traceId,
        spanId: spanContext.spanId,
        name,
        duration
      })
    }
  }

  /**
   * リクエストIDの生成
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36)
    const random = SecureRandom.generateString(9)
    return `req_${timestamp}_${random}`
  }

  /**
   * トレースIDの生成
   */
  private generateTraceId(): string {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * スパンIDの生成
   */
  private generateSpanId(): string {
    const bytes = new Uint8Array(8)
    crypto.getRandomValues(bytes)
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * リクエスト完了のログ
   */
  private logRequestCompletion(context: RequestContext, duration: number): void {
    const tags = Object.fromEntries(context.tags)
    const metrics = Object.fromEntries(context.metrics)

    logger.info('Request completed', {
      requestId: context.requestId,
      traceId: context.traceId,
      userId: context.userId,
      path: context.path,
      method: context.method,
      duration,
      tags,
      metrics
    })
  }

  /**
   * エラーコンテキストの追加
   */
  addErrorContext(error: Error): void {
    const context = this.getContext()
    if (context) {
      this.addTag('error.type', error.name)
      this.addTag('error.message', error.message)
      if (error.stack) {
        this.addTag('error.stack', error.stack.substring(0, 500))
      }
      this.recordMetric('error.count', 1)
    }
  }

  /**
   * ログにコンテキストを注入
   */
  enrichLog(logData: Record<string, any>): Record<string, any> {
    const context = this.getContext()
    if (!context) {
      return logData
    }

    return {
      ...logData,
      requestId: context.requestId,
      traceId: context.traceId,
      spanId: context.spanId,
      userId: context.userId,
      sessionId: context.sessionId
    }
  }
}

export const requestContext = RequestContextManager.getInstance()

/**
 * リクエストコンテキストデコレータ
 */
export function withRequestContext() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const context: Partial<RequestContext> = {
        path: propertyKey,
        method: target.constructor.name
      }

      return requestContext.runWithContext(context, async () => {
        return originalMethod.apply(this, args)
      })
    }

    return descriptor
  }
}

/**
 * トレーシングデコレータ
 */
export function trace(spanName?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const name = spanName || `${target.constructor.name}.${propertyKey}`

    descriptor.value = async function (...args: any[]) {
      return requestContext.withSpan(name, async () => {
        return originalMethod.apply(this, args)
      })
    }

    return descriptor
  }
}