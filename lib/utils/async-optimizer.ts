import { logger } from '@/lib/utils/logger'
import { performanceMonitor } from '@/lib/monitoring/performance'

interface TaskOptions {
  priority?: number
  timeout?: number
  retryOnFailure?: boolean
  maxRetries?: number
}

interface BatchOptions {
  maxBatchSize?: number
  maxWaitTime?: number
  processInParallel?: boolean
}

export class AsyncOptimizer {
  private static instance: AsyncOptimizer | null = null
  private taskQueue: Map<string, (() => Promise<any>)[]> = new Map()
  private batchProcessors: Map<string, NodeJS.Timeout> = new Map()
  private concurrencyLimits: Map<string, number> = new Map()
  private activeTasks: Map<string, number> = new Map()

  private readonly DEFAULT_CONCURRENCY = 5
  private readonly DEFAULT_BATCH_SIZE = 10

  private constructor() {
    this.initializeLimits()
  }

  static getInstance(): AsyncOptimizer {
    if (!this.instance) {
      this.instance = new AsyncOptimizer()
    }
    return this.instance
  }

  /**
   * 同時実行数の初期化
   */
  private initializeLimits(): void {
    this.concurrencyLimits.set('claude-api', 2) // Claude APIは2並列まで
    this.concurrencyLimits.set('line-api', 10) // LINE APIは10並列まで
    this.concurrencyLimits.set('database', 20) // データベースは20並列まで
    this.concurrencyLimits.set('default', this.DEFAULT_CONCURRENCY)
  }

  /**
   * 並列実行の最適化
   */
  async executeParallel<T>(
    tasks: (() => Promise<T>)[],
    options: {
      concurrency?: number
      onProgress?: (completed: number, total: number) => void
    } = {}
  ): Promise<T[]> {
    const concurrency = options.concurrency || this.DEFAULT_CONCURRENCY
    const results: T[] = new Array(tasks.length)
    const errors: Error[] = []
    let completed = 0

    performanceMonitor.startTimer('async.parallel')

    // チャンクに分割して実行
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, Math.min(i + concurrency, tasks.length))
      const chunkPromises = chunk.map(async (task, index) => {
        try {
          const result = await task()
          results[i + index] = result
          completed++
          
          if (options.onProgress) {
            options.onProgress(completed, tasks.length)
          }
          
          return result
        } catch (error) {
          errors.push(error as Error)
          throw error
        }
      })

      // チャンクの完了を待つ
      await Promise.allSettled(chunkPromises)
    }

    performanceMonitor.endTimer('async.parallel', {
      totalTasks: tasks.length,
      concurrency,
      errors: errors.length
    })

    if (errors.length > 0) {
      logger.warn('Parallel execution had errors', {
        totalTasks: tasks.length,
        errorCount: errors.length
      })
    }

    return results
  }

  /**
   * バッチ処理の最適化
   */
  async batchProcess<T, R>(
    items: T[],
    processor: (batch: T[]) => Promise<R[]>,
    options: BatchOptions = {}
  ): Promise<R[]> {
    const batchSize = options.maxBatchSize || this.DEFAULT_BATCH_SIZE
    const results: R[] = []

    performanceMonitor.startTimer('async.batch')

    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    if (options.processInParallel) {
      // バッチを並列処理
      const batchResults = await this.executeParallel(
        batches.map(batch => () => processor(batch)),
        { concurrency: 3 }
      )
      results.push(...batchResults.flat())
    } else {
      // バッチを順次処理
      for (const batch of batches) {
        const batchResult = await processor(batch)
        results.push(...batchResult)
      }
    }

    performanceMonitor.endTimer('async.batch', {
      totalItems: items.length,
      batchCount: batches.length,
      batchSize
    })

    return results
  }

  /**
   * 遅延実行の最適化（デバウンス）
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number,
    options: {
      leading?: boolean
      trailing?: boolean
      maxWait?: number
    } = {}
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null
    let lastCallTime: number | null = null
    let lastInvokeTime = 0
    let result: any
    
    const { leading = false, trailing = true, maxWait } = options

    return function debounced(...args: Parameters<T>) {
      const now = Date.now()

      if (lastCallTime === null && leading) {
        // 最初の呼び出しでleadingが有効
        result = func(...args)
        lastInvokeTime = now
      }

      lastCallTime = now

      const remaining = wait - (now - lastInvokeTime)
      const shouldInvoke = remaining <= 0 || (maxWait && now - lastInvokeTime >= maxWait)

      if (timeout) {
        clearTimeout(timeout)
      }

      if (shouldInvoke) {
        if (trailing) {
          result = func(...args)
          lastInvokeTime = now
        }
      } else {
        timeout = setTimeout(() => {
          if (trailing) {
            result = func(...args)
            lastInvokeTime = Date.now()
          }
          timeout = null
          lastCallTime = null
        }, remaining)
      }

      return result
    }
  }

  /**
   * スロットリングの最適化
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false
    let lastResult: any

    return function throttled(...args: Parameters<T>) {
      if (!inThrottle) {
        lastResult = func(...args)
        inThrottle = true
        setTimeout(() => {
          inThrottle = false
        }, limit)
      }
      return lastResult
    }
  }

  /**
   * 同時実行数制限付き実行
   */
  async executeWithConcurrencyLimit<T>(
    category: string,
    task: () => Promise<T>
  ): Promise<T> {
    const limit = this.concurrencyLimits.get(category) || this.DEFAULT_CONCURRENCY
    const active = this.activeTasks.get(category) || 0

    // 制限に達している場合は待機
    while (active >= limit) {
      await this.delay(50)
    }

    this.activeTasks.set(category, active + 1)

    try {
      return await task()
    } finally {
      const currentActive = this.activeTasks.get(category) || 1
      this.activeTasks.set(category, Math.max(0, currentActive - 1))
    }
  }

  /**
   * Promise.allのタイムアウト付き実行
   */
  async allWithTimeout<T>(
    promises: Promise<T>[],
    timeout: number
  ): Promise<T[]> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
    })

    return Promise.race([
      Promise.all(promises),
      timeoutPromise
    ])
  }

  /**
   * 逐次実行の最適化（前の結果を次に渡す）
   */
  async executeSequential<T>(
    tasks: ((prev: T | undefined) => Promise<T>)[],
    initialValue?: T
  ): Promise<T[]> {
    const results: T[] = []
    let previousResult: T | undefined = initialValue

    performanceMonitor.startTimer('async.sequential')

    for (const task of tasks) {
      try {
        const result = await task(previousResult)
        results.push(result)
        previousResult = result
      } catch (error) {
        logger.error('Sequential execution failed', {
          taskIndex: results.length,
          error
        })
        throw error
      }
    }

    performanceMonitor.endTimer('async.sequential', {
      taskCount: tasks.length
    })

    return results
  }

  /**
   * メモ化による重複実行の防止
   */
  memoize<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    options: {
      ttl?: number
      keyGenerator?: (...args: Parameters<T>) => string
    } = {}
  ): T {
    const cache = new Map<string, { value: any; expiry: number }>()
    const { ttl = 60000, keyGenerator = (...args) => JSON.stringify(args) } = options

    return (async (...args: Parameters<T>) => {
      const key = keyGenerator(...args)
      const cached = cache.get(key)

      if (cached && cached.expiry > Date.now()) {
        logger.debug('Cache hit', { key })
        return cached.value
      }

      const result = await fn(...args)
      cache.set(key, {
        value: result,
        expiry: Date.now() + ttl
      })

      // 古いエントリを定期的にクリーンアップ
      if (cache.size > 100) {
        const now = Date.now()
        for (const [k, v] of cache.entries()) {
          if (v.expiry < now) {
            cache.delete(k)
          }
        }
      }

      return result
    }) as T
  }

  /**
   * リトライ付きタスクキュー
   */
  async queueTask<T>(
    queueName: string,
    task: () => Promise<T>,
    options: TaskOptions = {}
  ): Promise<T> {
    if (!this.taskQueue.has(queueName)) {
      this.taskQueue.set(queueName, [])
    }

    const queue = this.taskQueue.get(queueName)!
    
    return new Promise((resolve, reject) => {
      const wrappedTask = async () => {
        const { timeout = 30000, retryOnFailure = false, maxRetries = 3 } = options
        let lastError: Error | null = null

        for (let attempt = 0; attempt <= (retryOnFailure ? maxRetries : 0); attempt++) {
          try {
            const result = await this.withTimeout(task(), timeout)
            resolve(result)
            return result
          } catch (error) {
            lastError = error as Error
            if (!retryOnFailure || attempt === maxRetries) {
              reject(error)
              throw error
            }
            await this.delay(Math.pow(2, attempt) * 1000) // Exponential backoff
          }
        }

        reject(lastError)
        throw lastError
      }

      queue.push(wrappedTask)
      this.processQueue(queueName)
    })
  }

  /**
   * キューの処理
   */
  private async processQueue(queueName: string): Promise<void> {
    const queue = this.taskQueue.get(queueName)
    if (!queue || queue.length === 0) return

    const task = queue.shift()
    if (task) {
      try {
        await task()
      } catch (error) {
        logger.error('Queue task failed', { queueName, error })
      }
      
      // 次のタスクを処理
      if (queue.length > 0) {
        setImmediate(() => this.processQueue(queueName))
      }
    }
  }

  /**
   * タイムアウト付きPromise
   */
  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    })
    return Promise.race([promise, timeout])
  }

  /**
   * 遅延処理
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    for (const timeout of this.batchProcessors.values()) {
      clearTimeout(timeout)
    }
    this.taskQueue.clear()
    this.batchProcessors.clear()
    this.activeTasks.clear()
    AsyncOptimizer.instance = null
  }
}

export const asyncOptimizer = AsyncOptimizer.getInstance()