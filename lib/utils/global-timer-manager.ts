/**
 * グローバルタイマー管理
 * メモリリークを防ぐための集中管理システム
 */

import { logger } from './logger'

export class GlobalTimerManager {
  private static instance: GlobalTimerManager | null = null
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private intervals: Map<string, NodeJS.Timeout> = new Map()
  private shutdownHandlers: Set<() => void> = new Set()
  private isShuttingDown = false

  private constructor() {
    // プロセス終了時のクリーンアップを登録
    this.registerShutdownHandlers()
  }

  static getInstance(): GlobalTimerManager {
    if (!this.instance) {
      this.instance = new GlobalTimerManager()
    }
    return this.instance
  }

  /**
   * setTimeoutのラッパー（自動クリーンアップ付き）
   */
  setTimeout(
    key: string,
    callback: () => void,
    delay: number,
    _options?: { autoCleanup?: boolean }
  ): void {
    // 既存のタイマーをクリア
    this.clearTimeout(key)

    const wrappedCallback = () => {
      this.timers.delete(key)
      try {
        callback()
      } catch (error) {
        logger.error('Timer callback error', { key, error })
      }
    }

    const timer = setTimeout(wrappedCallback, delay)
    this.timers.set(key, timer)

    logger.debug('Timer set', { key, delay, totalTimers: this.timers.size })
  }

  /**
   * setIntervalのラッパー（自動クリーンアップ付き）
   */
  setInterval(
    key: string,
    callback: () => void,
    interval: number
  ): void {
    // 既存のインターバルをクリア
    this.clearInterval(key)

    const wrappedCallback = () => {
      try {
        callback()
      } catch (error) {
        logger.error('Interval callback error', { key, error })
        // エラー時は自動停止
        this.clearInterval(key)
      }
    }

    const timer = setInterval(wrappedCallback, interval)
    this.intervals.set(key, timer)

    logger.debug('Interval set', { key, interval, totalIntervals: this.intervals.size })
  }

  /**
   * タイマーのクリア
   */
  clearTimeout(key: string): boolean {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
      logger.debug('Timer cleared', { key, remainingTimers: this.timers.size })
      return true
    }
    return false
  }

  /**
   * インターバルのクリア
   */
  clearInterval(key: string): boolean {
    const interval = this.intervals.get(key)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(key)
      logger.debug('Interval cleared', { key, remainingIntervals: this.intervals.size })
      return true
    }
    return false
  }

  /**
   * 指定パターンに一致するタイマーをクリア
   */
  clearPattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern
    let cleared = 0

    // タイマーのクリア
    for (const [key, timer] of this.timers.entries()) {
      if (regex.test(key)) {
        clearTimeout(timer)
        this.timers.delete(key)
        cleared++
      }
    }

    // インターバルのクリア
    for (const [key, interval] of this.intervals.entries()) {
      if (regex.test(key)) {
        clearInterval(interval)
        this.intervals.delete(key)
        cleared++
      }
    }

    if (cleared > 0) {
      logger.info('Timers cleared by pattern', { pattern: pattern.toString(), cleared })
    }

    return cleared
  }

  /**
   * 全タイマーのクリア
   */
  clearAll(): void {
    const timerCount = this.timers.size
    const intervalCount = this.intervals.size

    // 全タイマーをクリア
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()

    // 全インターバルをクリア
    for (const interval of this.intervals.values()) {
      clearInterval(interval)
    }
    this.intervals.clear()

    logger.info('All timers cleared', { timerCount, intervalCount })
  }

  /**
   * 統計情報の取得
   */
  getStats(): {
    timers: number
    intervals: number
    total: number
    keys: string[]
  } {
    return {
      timers: this.timers.size,
      intervals: this.intervals.size,
      total: this.timers.size + this.intervals.size,
      keys: [
        ...Array.from(this.timers.keys()),
        ...Array.from(this.intervals.keys())
      ]
    }
  }

  /**
   * メモリ使用量の推定
   */
  estimateMemoryUsage(): number {
    // 各タイマーが約1KBのメモリを使用すると仮定
    const estimatedBytesPerTimer = 1024
    return (this.timers.size + this.intervals.size) * estimatedBytesPerTimer
  }

  /**
   * タイマーリークの検出
   */
  detectLeaks(threshold: number = 100): boolean {
    const total = this.timers.size + this.intervals.size
    if (total > threshold) {
      logger.warn('Potential timer leak detected', {
        timers: this.timers.size,
        intervals: this.intervals.size,
        threshold,
        keys: this.getOldestTimers(10)
      })
      return true
    }
    return false
  }

  /**
   * 最も古いタイマーの取得
   */
  private getOldestTimers(limit: number): string[] {
    const allKeys = [
      ...Array.from(this.timers.keys()),
      ...Array.from(this.intervals.keys())
    ]
    return allKeys.slice(0, limit)
  }

  /**
   * シャットダウンハンドラーの登録
   */
  private registerShutdownHandlers(): void {
    const handler = () => {
      if (!this.isShuttingDown) {
        this.isShuttingDown = true
        this.shutdown()
      }
    }

    // Node.jsプロセスイベント
    if (typeof process !== 'undefined') {
      process.once('SIGTERM', handler)
      process.once('SIGINT', handler)
      process.once('beforeExit', handler)
    }

    // ブラウザイベント
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handler)
    }
  }

  /**
   * シャットダウン処理
   */
  shutdown(): void {
    logger.info('GlobalTimerManager shutting down', this.getStats())
    
    // 全タイマーをクリア
    this.clearAll()
    
    // シャットダウンハンドラーを実行
    for (const handler of this.shutdownHandlers) {
      try {
        handler()
      } catch (error) {
        logger.error('Shutdown handler error', { error })
      }
    }
    
    // インスタンスをリセット
    GlobalTimerManager.instance = null
  }

  /**
   * シャットダウンハンドラーの追加
   */
  onShutdown(handler: () => void): void {
    this.shutdownHandlers.add(handler)
  }

  /**
   * ガベージコレクション（定期的なクリーンアップ）
   */
  gc(maxAge: number = 3600000): number {
    // 実装：タイムスタンプベースのクリーンアップ
    // この実装では、キー名にタイムスタンプが含まれている場合にクリーンアップ
    const now = Date.now()
    let cleaned = 0

    for (const key of this.timers.keys()) {
      // キーからタイムスタンプを抽出（例: "timer_1234567890_xxx"）
      const match = key.match(/_(\d{10,13})_/)
      if (match) {
        const timestamp = parseInt(match[1])
        if (now - timestamp > maxAge) {
          this.clearTimeout(key)
          cleaned++
        }
      }
    }

    if (cleaned > 0) {
      logger.info('Timer GC completed', { cleaned })
    }

    return cleaned
  }
}

// グローバルインスタンスのエクスポート
export const globalTimerManager = GlobalTimerManager.getInstance()

/**
 * 安全なsetTimeoutラッパー
 */
export function safeSetTimeout(
  callback: () => void,
  delay: number,
  key?: string
): () => void {
  const timerKey = key || `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  globalTimerManager.setTimeout(timerKey, callback, delay)
  
  // クリア関数を返す
  return () => globalTimerManager.clearTimeout(timerKey)
}

/**
 * 安全なsetIntervalラッパー
 */
export function safeSetInterval(
  callback: () => void,
  interval: number,
  key?: string
): () => void {
  const timerKey = key || `interval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  globalTimerManager.setInterval(timerKey, callback, interval)
  
  // クリア関数を返す
  return () => globalTimerManager.clearInterval(timerKey)
}

/**
 * デバウンス付きタイマー
 */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number,
  key?: string
): T {
  const timerKey = key || `debounce_${func.name || 'anonymous'}`
  
  return ((...args: Parameters<T>) => {
    globalTimerManager.clearTimeout(timerKey)
    globalTimerManager.setTimeout(timerKey, () => func(...args), delay)
  }) as T
}

/**
 * スロットル付きタイマー
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  interval: number,
  _key?: string
): T {
  let lastCall = 0
  
  return ((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall >= interval) {
      lastCall = now
      func(...args)
    }
  }) as T
}