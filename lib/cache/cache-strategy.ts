import { logger } from '@/lib/utils/logger'
import { memoryManager } from '@/lib/utils/memory-manager'

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum cache size
  staleWhileRevalidate?: number // Return stale data while revalidating
  tags?: string[] // Cache tags for invalidation
}

interface CacheEntry<T> {
  value: T
  expires: number
  staleUntil?: number
  tags?: string[]
  hits: number
  lastAccessed: number
  size?: number
}

export class CacheStrategy {
  private static instance: CacheStrategy | null = null
  private caches: Map<string, Map<string, CacheEntry<any>>> = new Map()
  private tagIndex: Map<string, Set<string>> = new Map()
  private readonly DEFAULT_TTL = 300000 // 5分
  private readonly DEFAULT_MAX_SIZE = 100

  private constructor() {
    this.initializeCaches()
  }

  static getInstance(): CacheStrategy {
    if (!this.instance) {
      this.instance = new CacheStrategy()
    }
    return this.instance
  }

  /**
   * キャッシュの初期化
   */
  private initializeCaches(): void {
    // LINE APIレスポンスキャッシュ
    this.createCache('line-api', {
      ttl: 60000, // 1分
      maxSize: 50
    })

    // Claude APIレスポンスキャッシュ
    this.createCache('claude-api', {
      ttl: 3600000, // 1時間
      maxSize: 20
    })

    // データベースクエリキャッシュ
    this.createCache('database', {
      ttl: 30000, // 30秒
      maxSize: 200
    })

    // セッションキャッシュ
    this.createCache('session', {
      ttl: 1800000, // 30分
      maxSize: 100
    })
  }

  /**
   * キャッシュの作成
   */
  private createCache(name: string, defaultOptions: CacheOptions): void {
    const cache = memoryManager.createCache<any>(name, {
      maxSize: defaultOptions.maxSize,
      ttl: defaultOptions.ttl,
      cleanupInterval: 60000 // 1分ごとにクリーンアップ
    })
    this.caches.set(name, cache as unknown as Map<string, CacheEntry<any>>)
  }

  /**
   * キャッシュの取得
   */
  async get<T>(
    cacheName: string,
    key: string,
    fetcher?: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T | null> {
    const cache = this.caches.get(cacheName)
    if (!cache) {
      logger.warn('Cache not found', { cacheName })
      return fetcher ? await fetcher() : null
    }

    const entry = cache.get(key) as CacheEntry<T> | undefined
    const now = Date.now()

    // キャッシュヒット
    if (entry) {
      entry.hits++
      entry.lastAccessed = now

      // 有効期限内
      if (entry.expires > now) {
        logger.debug('Cache hit', { cacheName, key, hits: entry.hits })
        return entry.value
      }

      // Stale While Revalidate戦略
      if (entry.staleUntil && entry.staleUntil > now && fetcher) {
        logger.debug('Returning stale cache while revalidating', { cacheName, key })
        
        // 非同期で更新
        this.revalidate(cacheName, key, fetcher, options).catch(error => {
          logger.error('Cache revalidation failed', { cacheName, key, error })
        })
        
        return entry.value
      }
    }

    // キャッシュミスまたは期限切れ
    if (fetcher) {
      logger.debug('Cache miss, fetching', { cacheName, key })
      const value = await fetcher()
      await this.set(cacheName, key, value, options)
      return value
    }

    return null
  }

  /**
   * キャッシュの設定
   */
  async set<T>(
    cacheName: string,
    key: string,
    value: T,
    options: CacheOptions = {}
  ): Promise<void> {
    const cache = this.caches.get(cacheName)
    if (!cache) {
      logger.warn('Cache not found', { cacheName })
      return
    }

    const ttl = options.ttl || this.DEFAULT_TTL
    const now = Date.now()

    const entry: CacheEntry<T> = {
      value,
      expires: now + ttl,
      staleUntil: options.staleWhileRevalidate 
        ? now + ttl + options.staleWhileRevalidate 
        : undefined,
      tags: options.tags,
      hits: 0,
      lastAccessed: now,
      size: options.maxSize
    }

    // サイズ制限チェック
    if (cache.size >= (options.maxSize || this.DEFAULT_MAX_SIZE)) {
      this.evictLRU(cache)
    }

    cache.set(key, entry)

    // タグインデックスの更新
    if (options.tags) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set())
        }
        this.tagIndex.get(tag)!.add(`${cacheName}:${key}`)
      }
    }

    logger.debug('Cache set', { cacheName, key, ttl, tags: options.tags })
  }

  /**
   * バックグラウンドでの再検証
   */
  private async revalidate<T>(
    cacheName: string,
    key: string,
    fetcher: () => Promise<T>,
    options: CacheOptions
  ): Promise<void> {
    try {
      const value = await fetcher()
      await this.set(cacheName, key, value, options)
    } catch (error) {
      logger.error('Revalidation failed', { cacheName, key, error })
    }
  }

  /**
   * LRU削除
   */
  private evictLRU(cache: Map<string, CacheEntry<any>>): void {
    let lruKey: string | null = null
    let lruTime = Date.now()

    for (const [key, entry] of cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed
        lruKey = key
      }
    }

    if (lruKey) {
      cache.delete(lruKey)
      logger.debug('Evicted LRU entry', { key: lruKey })
    }
  }

  /**
   * キャッシュの無効化
   */
  invalidate(cacheName: string, key: string): void {
    const cache = this.caches.get(cacheName)
    if (cache) {
      cache.delete(key)
      logger.debug('Cache invalidated', { cacheName, key })
    }
  }

  /**
   * タグによる無効化
   */
  invalidateByTag(tag: string): void {
    const keys = this.tagIndex.get(tag)
    if (!keys) return

    for (const fullKey of keys) {
      const [cacheName, key] = fullKey.split(':')
      this.invalidate(cacheName, key)
    }

    this.tagIndex.delete(tag)
    logger.debug('Cache invalidated by tag', { tag, count: keys.size })
  }

  /**
   * パターンによる無効化
   */
  invalidateByPattern(cacheName: string, pattern: RegExp): void {
    const cache = this.caches.get(cacheName)
    if (!cache) return

    const keysToDelete: string[] = []
    for (const key of cache.keys()) {
      if (pattern.test(key)) {
        keysToDelete.push(key)
      }
    }

    for (const key of keysToDelete) {
      cache.delete(key)
    }

    logger.debug('Cache invalidated by pattern', { 
      cacheName, 
      pattern: pattern.toString(), 
      count: keysToDelete.length 
    })
  }

  /**
   * キャッシュのクリア
   */
  clear(cacheName?: string): void {
    if (cacheName) {
      const cache = this.caches.get(cacheName)
      if (cache) {
        cache.clear()
        logger.info('Cache cleared', { cacheName })
      }
    } else {
      for (const [, cache] of this.caches.entries()) {
        cache.clear()
      }
      this.tagIndex.clear()
      logger.info('All caches cleared')
    }
  }

  /**
   * キャッシュの統計情報
   */
  getStats(cacheName?: string): Record<string, any> {
    if (cacheName) {
      const cache = this.caches.get(cacheName)
      if (!cache) return {}

      let totalHits = 0
      let totalSize = 0
      let validEntries = 0
      let staleEntries = 0
      const now = Date.now()

      for (const entry of cache.values()) {
        totalHits += entry.hits
        if (entry.size) totalSize += entry.size
        
        if (entry.expires > now) {
          validEntries++
        } else if (entry.staleUntil && entry.staleUntil > now) {
          staleEntries++
        }
      }

      return {
        name: cacheName,
        entries: cache.size,
        validEntries,
        staleEntries,
        totalHits,
        averageHits: cache.size > 0 ? totalHits / cache.size : 0,
        totalSize
      }
    }

    // 全キャッシュの統計
    const stats: Record<string, any> = {}
    for (const name of this.caches.keys()) {
      stats[name] = this.getStats(name)
    }
    return stats
  }

  /**
   * キャッシュウォーミング
   */
  async warmup<T>(
    cacheName: string,
    items: Array<{ key: string; fetcher: () => Promise<T>; options?: CacheOptions }>
  ): Promise<void> {
    logger.info('Cache warmup started', { cacheName, count: items.length })

    const promises = items.map(async ({ key, fetcher, options }) => {
      try {
        const value = await fetcher()
        await this.set(cacheName, key, value, options)
      } catch (error) {
        logger.error('Cache warmup failed for key', { cacheName, key, error })
      }
    })

    await Promise.allSettled(promises)
    logger.info('Cache warmup completed', { cacheName })
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.clear()
    this.caches.clear()
    CacheStrategy.instance = null
  }
}

export const cacheStrategy = CacheStrategy.getInstance()