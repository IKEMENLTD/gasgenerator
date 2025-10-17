/**
 * メモリ監視システム
 *
 * 🔧 修正履歴:
 * - 2025-10-17: メモリリーク対策として作成
 */

import { logger } from '../utils/logger'
import { ConversationSessionStore } from '../conversation/session-store'

export class MemoryMonitor {
  private static readonly WARNING_THRESHOLD = 0.8 // 80%
  private static readonly CRITICAL_THRESHOLD = 0.9 // 90%
  private static readonly CHECK_INTERVAL = 30000 // 30秒
  private static checkTimer: NodeJS.Timeout | null = null

  /**
   * メモリ監視を開始
   */
  static start(): void {
    if (this.checkTimer) {
      logger.warn('Memory monitor already running')
      return
    }

    logger.info('Starting memory monitor', {
      warningThreshold: `${this.WARNING_THRESHOLD * 100}%`,
      criticalThreshold: `${this.CRITICAL_THRESHOLD * 100}%`,
      checkInterval: `${this.CHECK_INTERVAL / 1000}s`
    })

    // 即座に一度チェック
    this.check()

    // 定期的にチェック
    this.checkTimer = setInterval(() => {
      this.check()
    }, this.CHECK_INTERVAL)
  }

  /**
   * メモリ監視を停止
   */
  static stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
      logger.info('Memory monitor stopped')
    }
  }

  /**
   * メモリ状態をチェック
   */
  static check(): void {
    const usage = process.memoryUsage()
    const heapUsageRatio = usage.heapUsed / usage.heapTotal

    // セッションストアの統計を取得
    const sessionStore = ConversationSessionStore.getInstance()
    const sessionStats = sessionStore.getStats()

    const memoryInfo = {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      heapUsagePercent: Math.round(heapUsageRatio * 100),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      sessionStoreSize: sessionStats.size,
      sessionStoreUtilization: Math.round(sessionStats.utilizationPercent)
    }

    // クリティカルレベル
    if (heapUsageRatio > this.CRITICAL_THRESHOLD) {
      logger.error('CRITICAL memory usage detected', {
        ...memoryInfo,
        threshold: `${this.CRITICAL_THRESHOLD * 100}%`,
        action: 'forcing_emergency_cleanup'
      })

      // 緊急クリーンアップを実行
      this.emergencyCleanup()

      // 強制ガベージコレクション（--expose-gc フラグが必要）
      if (global.gc) {
        global.gc()
        logger.info('Manual garbage collection triggered')

        // GC後の状態を記録
        const afterGC = process.memoryUsage()
        const afterHeapUsageRatio = afterGC.heapUsed / afterGC.heapTotal
        logger.info('Memory after GC', {
          heapUsed: Math.round(afterGC.heapUsed / 1024 / 1024),
          heapTotal: Math.round(afterGC.heapTotal / 1024 / 1024),
          heapUsagePercent: Math.round(afterHeapUsageRatio * 100),
          freedMB: Math.round((usage.heapUsed - afterGC.heapUsed) / 1024 / 1024)
        })
      } else {
        logger.warn('Manual GC not available (--expose-gc flag not set)')
      }
    }
    // 警告レベル
    else if (heapUsageRatio > this.WARNING_THRESHOLD) {
      logger.warn('High memory usage detected', {
        ...memoryInfo,
        threshold: `${this.WARNING_THRESHOLD * 100}%`,
        action: 'monitoring'
      })

      // 軽度のクリーンアップ（古いセッションのみ）
      sessionStore.cleanup()
    }
    // 正常レベル（デバッグログ）
    else {
      logger.debug('Memory usage normal', memoryInfo)
    }
  }

  /**
   * 緊急クリーンアップを実行
   */
  private static emergencyCleanup(): void {
    try {
      // 1. セッションストアの強制クリーンアップ
      const sessionStore = ConversationSessionStore.getInstance()
      sessionStore.cleanup()

      const stats = sessionStore.getStats()
      logger.info('Emergency session cleanup completed', {
        remainingSessions: stats.size,
        utilizationPercent: Math.round(stats.utilizationPercent)
      })

      // 2. メモリマネージャーのキャッシュクリア（存在する場合）
      try {
        const { memoryManager } = require('../utils/memory-manager')
        if (memoryManager && typeof memoryManager.clearCache === 'function') {
          memoryManager.clearCache('conversation-sessions')
          logger.info('Memory manager cache cleared')
        }
      } catch (error) {
        // メモリマネージャーが存在しない場合は無視
        logger.debug('Memory manager not available or clearCache not supported')
      }

      // 3. その他のグローバルキャッシュがあればクリア
      // （将来的に追加する場合はここに記述）

    } catch (error) {
      logger.error('Emergency cleanup failed', {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  /**
   * 現在のメモリ情報を取得
   */
  static getMemoryInfo(): {
    heapUsed: string
    heapTotal: string
    heapUsagePercent: number
    rss: string
    external: string
    isHealthy: boolean
  } {
    const usage = process.memoryUsage()
    const heapUsageRatio = usage.heapUsed / usage.heapTotal

    return {
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      heapUsagePercent: Math.round(heapUsageRatio * 100),
      rss: `${Math.round(usage.rss / 1024 / 1024)}MB`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`,
      isHealthy: heapUsageRatio < this.WARNING_THRESHOLD
    }
  }

  /**
   * セッションストアの統計を取得
   */
  static getSessionStats(): {
    size: number
    maxSize: number
    utilizationPercent: number
    activeSessions: number
    oldestSessionAge: number | null
    timeUntilNextCleanup: number
  } {
    const sessionStore = ConversationSessionStore.getInstance()
    return sessionStore.getStats()
  }

  /**
   * 完全な診断情報を取得
   */
  static getDiagnostics(): {
    memory: ReturnType<typeof MemoryMonitor.getMemoryInfo>
    sessions: ReturnType<typeof MemoryMonitor.getSessionStats>
    timestamp: string
  } {
    return {
      memory: this.getMemoryInfo(),
      sessions: this.getSessionStats(),
      timestamp: new Date().toISOString()
    }
  }
}

// プロセス終了時にクリーンアップ
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, stopping memory monitor')
    MemoryMonitor.stop()
  })

  process.on('SIGINT', () => {
    logger.info('SIGINT received, stopping memory monitor')
    MemoryMonitor.stop()
  })
}
