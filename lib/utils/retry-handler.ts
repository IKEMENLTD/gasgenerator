import { logger } from '@/lib/utils/logger'
import { ErrorHandler } from '@/lib/errors/error-handler'

export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: any) => void
  timeout?: number
}

export class RetryHandler {
  private static readonly DEFAULT_OPTIONS: RetryOptions = {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'RATE_LIMIT_EXCEEDED',
      'SERVICE_UNAVAILABLE'
    ]
  }

  /**
   * リトライ付きで関数を実行
   */
  static async execute<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    let lastError: any
    let delay = opts.initialDelay!

    for (let attempt = 1; attempt <= opts.maxAttempts!; attempt++) {
      try {
        // タイムアウト設定
        if (opts.timeout) {
          return await this.withTimeout(fn(), opts.timeout)
        } else {
          return await fn()
        }
      } catch (error) {
        lastError = error
        
        // リトライ可能かチェック
        if (!this.isRetryableError(error, opts.retryableErrors!)) {
          logger.debug('Non-retryable error', {
            attempt,
            error: error instanceof Error ? error.message : String(error)
          })
          throw error
        }

        // 最後の試行の場合はエラーをスロー
        if (attempt === opts.maxAttempts) {
          logger.error('Max retry attempts reached', {
            attempts: opts.maxAttempts,
            finalError: error instanceof Error ? error.message : String(error)
          })
          throw error
        }

        // リトライコールバック
        if (opts.onRetry) {
          opts.onRetry(attempt, error)
        }

        logger.warn('Retrying after error', {
          attempt,
          nextAttempt: attempt + 1,
          delay,
          error: error instanceof Error ? error.message : String(error)
        })

        // バックオフ待機
        await this.delay(delay)
        
        // 次回の遅延を計算（指数バックオフ）
        delay = Math.min(delay * opts.backoffMultiplier!, opts.maxDelay!)
      }
    }

    throw lastError
  }

  /**
   * 複数の操作を並列実行（部分的な失敗を許容）
   */
  static async executeParallel<T>(
    operations: Array<() => Promise<T>>,
    options: RetryOptions & { allowPartialFailure?: boolean } = {}
  ): Promise<{ results: T[]; errors: any[] }> {
    const results: T[] = []
    const errors: any[] = []

    const promises = operations.map(async (operation, index) => {
      try {
        const result = await this.execute(operation, options)
        results[index] = result
      } catch (error) {
        errors[index] = error
        if (!options.allowPartialFailure) {
          throw error
        }
      }
    })

    if (options.allowPartialFailure) {
      await Promise.allSettled(promises)
    } else {
      await Promise.all(promises)
    }

    return { results, errors }
  }

  /**
   * サーキットブレーカー付きリトライ
   */
  static createCircuitBreaker<T>(
    fn: () => Promise<T>,
    options: {
      failureThreshold?: number
      resetTimeout?: number
      halfOpenRequests?: number
    } = {}
  ) {
    const state = {
      failures: 0,
      lastFailureTime: 0,
      state: 'closed' as 'closed' | 'open' | 'half-open',
      halfOpenAttempts: 0
    }

    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      halfOpenRequests = 3
    } = options

    return async (): Promise<T> => {
      // サーキットオープン状態のチェック
      if (state.state === 'open') {
        const timeSinceLastFailure = Date.now() - state.lastFailureTime
        if (timeSinceLastFailure < resetTimeout) {
          throw new Error('Circuit breaker is open')
        }
        // ハーフオープン状態に移行
        state.state = 'half-open'
        state.halfOpenAttempts = 0
      }

      try {
        const result = await fn()
        
        // 成功時の処理
        if (state.state === 'half-open') {
          state.halfOpenAttempts++
          if (state.halfOpenAttempts >= halfOpenRequests) {
            // 完全に回復
            state.state = 'closed'
            state.failures = 0
            logger.info('Circuit breaker recovered')
          }
        } else {
          state.failures = 0
        }
        
        return result
      } catch (error) {
        // 失敗時の処理
        state.failures++
        state.lastFailureTime = Date.now()
        
        if (state.failures >= failureThreshold) {
          state.state = 'open'
          logger.error('Circuit breaker opened', {
            failures: state.failures,
            threshold: failureThreshold
          })
        }
        
        throw error
      }
    }
  }

  /**
   * フォールバック付き実行
   */
  static async executeWithFallback<T>(
    primary: () => Promise<T>,
    fallback: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    try {
      return await this.execute(primary, options)
    } catch (primaryError) {
      logger.warn('Primary operation failed, trying fallback', {
        primaryError: primaryError instanceof Error ? primaryError.message : String(primaryError)
      })
      
      try {
        return await fallback()
      } catch (fallbackError) {
        logger.error('Both primary and fallback failed', {
          primaryError,
          fallbackError
        })
        throw primaryError // 元のエラーを返す
      }
    }
  }

  /**
   * リトライ可能なエラーかチェック
   */
  private static isRetryableError(error: any, retryableErrors: string[]): boolean {
    // ErrorHandlerの判定を使用
    if (ErrorHandler.isRetryable(error)) {
      return true
    }

    // カスタムエラーチェック
    const errorMessage = error?.message || error?.code || String(error)
    return retryableErrors.some(pattern => 
      errorMessage.includes(pattern)
    )
  }

  /**
   * タイムアウト付きPromise
   */
  private static async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    })
    return Promise.race([promise, timeout])
  }

  /**
   * 遅延処理
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * ジッター付き遅延（同時リトライの分散）
   */
  static async delayWithJitter(baseDelay: number, maxJitter: number = 0.3): Promise<void> {
    const jitter = Math.random() * maxJitter * baseDelay
    const delay = baseDelay + jitter
    return this.delay(Math.floor(delay))
  }
}