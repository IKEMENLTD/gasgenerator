import { ConversationContext } from '@/lib/conversation/conversational-flow'
import { logger } from '@/lib/utils/logger'

interface CacheEntry<T> {
  data: T
  timestamp: number
  hits: number
}

/**
 * 会話キャッシュ管理（LRU + TTL）
 */
export class ConversationCache {
  private static instance: ConversationCache
  private cache: Map<string, CacheEntry<ConversationContext>>
  private accessOrder: string[] = []
  
  private readonly MAX_SIZE = 100  // 最大100セッション
  private readonly TTL = 30 * 60 * 1000  // 30分
  private readonly WARM_UP_THRESHOLD = 3  // 3回アクセスでホットデータ

  private constructor() {
    this.cache = new Map()
    this.startCleanupTimer()
  }

  static getInstance(): ConversationCache {
    if (!this.instance) {
      this.instance = new ConversationCache()
    }
    return this.instance
  }

  /**
   * キャッシュから取得
   */
  get(userId: string): ConversationContext | null {
    const entry = this.cache.get(userId)
    
    if (!entry) {
      return null
    }

    // TTLチェック
    if (Date.now() - entry.timestamp > this.TTL) {
      this.cache.delete(userId)
      this.removeFromAccessOrder(userId)
      logger.debug('Cache entry expired', { userId })
      return null
    }

    // ヒット数を増やしてアクセス順を更新
    entry.hits++
    this.updateAccessOrder(userId)
    
    return entry.data
  }

  /**
   * キャッシュに保存
   */
  set(userId: string, context: ConversationContext): void {
    // サイズ制限チェック
    if (this.cache.size >= this.MAX_SIZE && !this.cache.has(userId)) {
      this.evictLRU()
    }

    const entry: CacheEntry<ConversationContext> = {
      data: context,
      timestamp: Date.now(),
      hits: 1
    }

    this.cache.set(userId, entry)
    this.updateAccessOrder(userId)
    
    logger.debug('Context cached', { 
      userId, 
      cacheSize: this.cache.size,
      messageCount: context.messages.length 
    })
  }

  /**
   * キャッシュから削除
   */
  delete(userId: string): void {
    this.cache.delete(userId)
    this.removeFromAccessOrder(userId)
  }

  /**
   * ホットデータかどうか判定
   */
  isHot(userId: string): boolean {
    const entry = this.cache.get(userId)
    return entry ? entry.hits >= this.WARM_UP_THRESHOLD : false
  }

  /**
   * プリフェッチ候補を取得
   */
  getPrefetchCandidates(limit: number = 5): string[] {
    return Array.from(this.cache.entries())
      .filter(([_, entry]) => entry.hits >= this.WARM_UP_THRESHOLD)
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, limit)
      .map(([userId]) => userId)
  }

  /**
   * LRU削除
   */
  private evictLRU(): void {
    // 最もアクセスが古く、ヒット数が少ないエントリを削除
    const candidates = this.accessOrder.slice(0, Math.ceil(this.MAX_SIZE * 0.1))
    
    let victimId: string | null = null
    let minScore = Infinity
    
    for (const userId of candidates) {
      const entry = this.cache.get(userId)
      if (entry) {
        // スコア = 経過時間 / (ヒット数 + 1)
        const age = Date.now() - entry.timestamp
        const score = age / (entry.hits + 1)
        
        if (score > minScore) {
          minScore = score
          victimId = userId
        }
      }
    }
    
    if (victimId) {
      this.delete(victimId)
      logger.debug('Cache entry evicted', { userId: victimId })
    }
  }

  /**
   * アクセス順を更新
   */
  private updateAccessOrder(userId: string): void {
    this.removeFromAccessOrder(userId)
    this.accessOrder.push(userId)
  }

  /**
   * アクセス順から削除
   */
  private removeFromAccessOrder(userId: string): void {
    const index = this.accessOrder.indexOf(userId)
    if (index > -1) {
      this.accessOrder.splice(index, 1)
    }
  }

  /**
   * 定期クリーンアップ
   */
  private startCleanupTimer(): void {
    setInterval(() => {
      const now = Date.now()
      const expired: string[] = []
      
      for (const [userId, entry] of this.cache.entries()) {
        if (now - entry.timestamp > this.TTL) {
          expired.push(userId)
        }
      }
      
      for (const userId of expired) {
        this.delete(userId)
      }
      
      if (expired.length > 0) {
        logger.info('Cache cleanup completed', { 
          expiredCount: expired.length,
          remainingSize: this.cache.size 
        })
      }
    }, 5 * 60 * 1000)  // 5分ごと
  }

  /**
   * キャッシュ統計
   */
  getStats(): {
    size: number
    hotDataCount: number
    avgHits: number
    memoryUsage: number
  } {
    let totalHits = 0
    let hotCount = 0
    let memoryUsage = 0
    
    for (const entry of this.cache.values()) {
      totalHits += entry.hits
      if (entry.hits >= this.WARM_UP_THRESHOLD) {
        hotCount++
      }
      // 概算メモリ使用量（JSON文字列のバイト数）
      memoryUsage += JSON.stringify(entry.data).length
    }
    
    return {
      size: this.cache.size,
      hotDataCount: hotCount,
      avgHits: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      memoryUsage
    }
  }

  /**
   * キャッシュをクリア
   */
  clear(): void {
    this.cache.clear()
    this.accessOrder = []
    logger.info('Cache cleared')
  }
}