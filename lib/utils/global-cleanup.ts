import { logger } from './logger'

/**
 * グローバルなクリーンアップ管理
 */
class GlobalCleanupManager {
  private cleanupHandlers: Set<() => void | Promise<void>> = new Set()
  private isShuttingDown = false
  private cleanupTimeout = 5000 // 5秒でタイムアウト
  
  /**
   * クリーンアップハンドラーを登録
   */
  register(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.add(handler)
  }
  
  /**
   * クリーンアップハンドラーを解除
   */
  unregister(handler: () => void | Promise<void>): void {
    this.cleanupHandlers.delete(handler)
  }
  
  /**
   * すべてのクリーンアップを実行
   */
  async executeCleanup(): Promise<void> {
    if (this.isShuttingDown) {
      return // 既にクリーンアップ中
    }
    
    this.isShuttingDown = true
    logger.info('Starting global cleanup', { 
      handlerCount: this.cleanupHandlers.size 
    })
    
    const cleanupPromises: Promise<void>[] = []
    
    for (const handler of this.cleanupHandlers) {
      try {
        const result = handler()
        if (result instanceof Promise) {
          cleanupPromises.push(
            result.catch(error => {
              logger.error('Cleanup handler error', { error })
            })
          )
        }
      } catch (error) {
        logger.error('Sync cleanup handler error', { error })
      }
    }
    
    // タイムアウト付きで待機
    if (cleanupPromises.length > 0) {
      await Promise.race([
        Promise.all(cleanupPromises),
        new Promise(resolve => setTimeout(resolve, this.cleanupTimeout))
      ])
    }
    
    logger.info('Global cleanup completed')
  }
  
  /**
   * メモリ使用量を監視してアラート
   */
  monitorMemory(): void {
    if (typeof process === 'undefined') return
    
    const checkMemory = () => {
      const usage = process.memoryUsage()
      const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024)
      const heapTotalMB = Math.round(usage.heapTotal / 1024 / 1024)
      const percentage = Math.round((usage.heapUsed / usage.heapTotal) * 100)
      
      if (percentage > 90) {
        logger.error('Critical memory usage', {
          heapUsedMB,
          heapTotalMB,
          percentage: `${percentage}%`
        })
        
        // 緊急GC実行（Node.js限定）
        if (global.gc) {
          global.gc()
          logger.info('Manual GC triggered')
        }
      } else if (percentage > 80) {
        logger.warn('High memory usage', {
          heapUsedMB,
          heapTotalMB,
          percentage: `${percentage}%`
        })
      }
    }
    
    // 初回チェック
    checkMemory()
    
    // 定期チェック（1分ごと）
    const intervalId = setInterval(checkMemory, 60000)
    
    // クリーンアップハンドラーに登録
    this.register(() => clearInterval(intervalId))
  }
  
  /**
   * タイマーやインターバルの管理
   */
  createManagedTimer(
    callback: () => void,
    delay: number,
    type: 'timeout' | 'interval' = 'timeout'
  ): NodeJS.Timeout {
    let timer: NodeJS.Timeout
    
    if (type === 'timeout') {
      timer = setTimeout(() => {
        callback()
        this.timers.delete(timer)
      }, delay)
    } else {
      timer = setInterval(callback, delay)
    }
    
    this.timers.add(timer)
    return timer
  }
  
  private timers = new Set<NodeJS.Timeout>()
  
  /**
   * すべてのタイマーをクリア
   */
  clearAllTimers(): void {
    for (const timer of this.timers) {
      clearTimeout(timer)
      clearInterval(timer)
    }
    this.timers.clear()
  }
}

// シングルトンインスタンス
export const globalCleanup = new GlobalCleanupManager()

// プロセス終了時の自動クリーンアップ設定
if (typeof process !== 'undefined') {
  const handleShutdown = async (signal: string) => {
    logger.info(`${signal} received, initiating shutdown...`)
    await globalCleanup.executeCleanup()
    process.exit(0)
  }
  
  process.on('SIGTERM', () => handleShutdown('SIGTERM'))
  process.on('SIGINT', () => handleShutdown('SIGINT'))
  
  // 未処理のエラーをキャッチ
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error })
    handleShutdown('uncaughtException')
  })
  
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise })
  })
}

// メモリ監視を開始
if (process.env.NODE_ENV === 'production') {
  globalCleanup.monitorMemory()
}