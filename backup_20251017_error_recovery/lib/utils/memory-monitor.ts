import { logger } from './logger'

export class MemoryMonitor {
  private static lastGC = Date.now()
  private static readonly GC_INTERVAL = 60000 // 1分ごと
  
  /**
   * メモリ状態をチェックし、必要に応じてGCを実行
   */
  static checkMemory(): void {
    const memUsage = process.memoryUsage()
    const heapUsageRatio = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    
    // 80%を超えたら警告
    if (heapUsageRatio > 80) {
      logger.warn('High memory usage detected', {
        heapUsageRatio,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss
      })
      
      // 強制的にGC実行
      this.forceGC()
    }
    
    // 定期的なGC実行
    const now = Date.now()
    if (now - this.lastGC > this.GC_INTERVAL) {
      this.forceGC()
      this.lastGC = now
    }
  }
  
  /**
   * 強制的にガベージコレクションを実行
   */
  static forceGC(): void {
    if (global.gc) {
      logger.info('Forcing garbage collection')
      global.gc()
      
      // GC後のメモリ状態を記録
      const memUsage = process.memoryUsage()
      const heapUsageRatio = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      logger.info('Memory after GC', {
        heapUsageRatio,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      })
    }
  }
  
  /**
   * メモリリークの可能性をチェック
   */
  static detectMemoryLeak(): boolean {
    const memUsage = process.memoryUsage()
    const heapUsageRatio = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    
    // 90%を超えたらメモリリークの可能性
    if (heapUsageRatio > 90) {
      logger.error('Possible memory leak detected', {
        heapUsageRatio,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external
      })
      return true
    }
    
    return false
  }
}