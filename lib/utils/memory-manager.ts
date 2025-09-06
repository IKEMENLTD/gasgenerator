import { logger } from '@/lib/utils/logger'

interface MemoryStats {
  heapUsed: number
  heapTotal: number
  external: number
  rss: number
  arrayBuffers: number
}

interface CacheEntry<T> {
  value: T
  createdAt: number
  lastAccessed: number
  accessCount: number
  size?: number
}

export class MemoryManager {
  private static instance: MemoryManager | null = null
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map()
  private cleanupIntervals: Map<string, NodeJS.Timeout> = new Map()
  private memoryThreshold = 0.8 // 80%メモリ使用率で警告
  private monitorInterval: NodeJS.Timeout | null = null

  private constructor() {
    this.startMemoryMonitoring()
  }

  static getInstance(): MemoryManager {
    if (!this.instance) {
      this.instance = new MemoryManager()
    }
    return this.instance
  }

  /**
   * キャッシュの作成
   */
  createCache<T>(
    name: string,
    options: {
      maxSize?: number
      ttl?: number
      cleanupInterval?: number
    } = {}
  ): Map<string, CacheEntry<T>> {
    if (this.caches.has(name)) {
      logger.warn('Cache already exists', { name })
      return this.caches.get(name)!
    }

    const cache = new Map<string, CacheEntry<T>>()
    this.caches.set(name, cache)

    // クリーンアップタイマーの設定
    if (options.cleanupInterval) {
      const interval = setInterval(() => {
        this.cleanupCache(name, options.ttl || 300000, options.maxSize || 1000)
      }, options.cleanupInterval)
      this.cleanupIntervals.set(name, interval)
    }

    return cache
  }

  /**
   * キャッシュにアイテムを追加
   */
  setCacheItem<T>(cacheName: string, key: string, value: T, estimatedSize?: number): void {
    const cache = this.caches.get(cacheName)
    if (!cache) {
      logger.error('Cache not found', { cacheName })
      return
    }

    cache.set(key, {
      value,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
      accessCount: 1,
      size: estimatedSize
    })
  }

  /**
   * キャッシュからアイテムを取得
   */
  getCacheItem<T>(cacheName: string, key: string): T | null {
    const cache = this.caches.get(cacheName)
    if (!cache) return null

    const entry = cache.get(key)
    if (!entry) return null

    // アクセス情報を更新
    entry.lastAccessed = Date.now()
    entry.accessCount++

    return entry.value
  }

  /**
   * キャッシュのクリーンアップ
   */
  private cleanupCache(cacheName: string, ttl: number, maxSize: number): void {
    const cache = this.caches.get(cacheName)
    if (!cache) return

    const now = Date.now()
    const toDelete: string[] = []

    // TTL切れのエントリを削除
    for (const [key, entry] of cache.entries()) {
      if (now - entry.createdAt > ttl) {
        toDelete.push(key)
      }
    }

    // サイズ制限超過時は最も古いエントリを削除
    if (cache.size > maxSize) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      
      const deleteCount = cache.size - maxSize
      for (let i = 0; i < deleteCount; i++) {
        toDelete.push(entries[i][0])
      }
    }

    // 削除実行
    for (const key of toDelete) {
      cache.delete(key)
    }

    if (toDelete.length > 0) {
      logger.debug('Cache cleanup', {
        cacheName,
        deletedCount: toDelete.length,
        remainingSize: cache.size
      })
    }
  }

  /**
   * メモリ使用状況の監視
   */
  private startMemoryMonitoring(): void {
    if (typeof process === 'undefined' || !process.memoryUsage) {
      // Edge Runtimeではメモリ監視不可
      return
    }

    this.monitorInterval = setInterval(() => {
      try {
        const usage = process.memoryUsage()
        const stats: MemoryStats = {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          rss: usage.rss,
          arrayBuffers: usage.arrayBuffers || 0
        }

        const heapUsageRatio = stats.heapUsed / stats.heapTotal

        if (heapUsageRatio > this.memoryThreshold) {
          logger.warn('High memory usage detected', {
            heapUsageRatio: Math.round(heapUsageRatio * 100),
            stats
          })
          this.performEmergencyCleanup()
        }
      } catch (error) {
        // Edge Runtimeでのエラーは無視
      }
    }, 30000) // 30秒ごとにチェック
  }

  /**
   * 緊急クリーンアップ
   */
  private performEmergencyCleanup(): void {
    logger.info('Performing emergency memory cleanup')

    // 全キャッシュの50%を削除
    for (const [cacheName, cache] of this.caches.entries()) {
      const entries = Array.from(cache.entries())
        .sort((a, b) => a[1].accessCount - b[1].accessCount)
      
      const deleteCount = Math.floor(cache.size / 2)
      for (let i = 0; i < deleteCount; i++) {
        cache.delete(entries[i][0])
      }

      logger.debug('Emergency cleanup completed', {
        cacheName,
        deletedCount: deleteCount,
        remainingSize: cache.size
      })
    }

    // ガベージコレクションのトリガー（Node.js環境のみ）
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * 特定のキャッシュをクリア
   */
  clearCache(cacheName: string): void {
    const cache = this.caches.get(cacheName)
    if (cache) {
      cache.clear()
      logger.info('Cache cleared', { cacheName })
    }
  }

  /**
   * 全キャッシュをクリア
   */
  clearAllCaches(): void {
    for (const [name, cache] of this.caches.entries()) {
      cache.clear()
    }
    logger.info('All caches cleared')
  }

  /**
   * クリーンアップタイマーの停止
   */
  destroy(): void {
    // クリーンアップタイマーを停止
    for (const interval of this.cleanupIntervals.values()) {
      clearInterval(interval)
    }
    this.cleanupIntervals.clear()

    // メモリ監視を停止
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval)
      this.monitorInterval = null
    }

    // キャッシュをクリア
    this.clearAllCaches()
    this.caches.clear()

    MemoryManager.instance = null
    logger.info('MemoryManager destroyed')
  }

  /**
   * メモリ使用状況のレポート
   */
  getMemoryReport(): {
    caches: Array<{ name: string; size: number; totalSize?: number }>
    memory?: MemoryStats
  } {
    const caches = Array.from(this.caches.entries()).map(([name, cache]) => {
      let totalSize = 0
      for (const entry of cache.values()) {
        if (entry.size) totalSize += entry.size
      }
      return {
        name,
        size: cache.size,
        totalSize: totalSize > 0 ? totalSize : undefined
      }
    })

    let memory: MemoryStats | undefined
    if (typeof process !== 'undefined' && process.memoryUsage) {
      try {
        const usage = process.memoryUsage()
        memory = {
          heapUsed: usage.heapUsed,
          heapTotal: usage.heapTotal,
          external: usage.external,
          rss: usage.rss,
          arrayBuffers: usage.arrayBuffers || 0
        }
      } catch {
        // Edge Runtimeでは取得不可
      }
    }

    return { caches, memory }
  }
}

// グローバルインスタンス
export const memoryManager = MemoryManager.getInstance()