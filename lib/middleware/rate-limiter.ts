import { NextRequest, NextResponse } from 'next/server'
import { AppError } from '@/lib/errors/app-error'
import { logger } from '@/lib/utils/logger'

interface RateLimitConfig {
  windowMs: number  // 時間枠（ミリ秒）
  maxRequests: number  // 最大リクエスト数
  keyGenerator?: (req: NextRequest) => string  // キー生成関数
  skipSuccessfulRequests?: boolean  // 成功したリクエストをカウントしない
  skipFailedRequests?: boolean  // 失敗したリクエストをカウントしない
}

interface RateLimitStore {
  count: number
  resetTime: number
}

// メモリストア（本番環境ではRedisを使用すべき）
class MemoryStore {
  private store: Map<string, RateLimitStore> = new Map()
  private cleanupInterval: NodeJS.Timeout
  
  constructor() {
    // 1分ごとに期限切れエントリをクリーンアップ
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
  }
  
  get(key: string): RateLimitStore | null {
    const entry = this.store.get(key)
    if (!entry) return null
    
    // 期限切れチェック
    if (Date.now() > entry.resetTime) {
      this.store.delete(key)
      return null
    }
    
    return entry
  }
  
  set(key: string, value: RateLimitStore): void {
    this.store.set(key, value)
  }
  
  increment(key: string, windowMs: number): number {
    const now = Date.now()
    let entry = this.get(key)
    
    if (!entry) {
      entry = {
        count: 1,
        resetTime: now + windowMs
      }
      this.set(key, entry)
      return 1
    }
    
    entry.count++
    this.set(key, entry)
    return entry.count
  }
  
  private cleanup(): void {
    const now = Date.now()
    for (const [key, value] of this.store.entries()) {
      if (now > value.resetTime) {
        this.store.delete(key)
      }
    }
  }
  
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.store.clear()
  }
}

// グローバルストア
const globalStore = new MemoryStore()

/**
 * レート制限ミドルウェア
 */
export class RateLimiter {
  private config: RateLimitConfig
  private store: MemoryStore
  
  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = {
      windowMs: 60 * 1000, // デフォルト: 1分
      maxRequests: 60, // デフォルト: 60リクエスト/分
      keyGenerator: this.defaultKeyGenerator,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      ...config
    }
    
    this.store = globalStore
  }
  
  /**
   * デフォルトのキー生成（IPアドレスベース）
   */
  private defaultKeyGenerator(req: NextRequest): string {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               req.headers.get('x-real-ip') ||
               'unknown'
    return `rate-limit:${ip}`
  }
  
  /**
   * レート制限チェック
   */
  async check(req: NextRequest): Promise<NextResponse | null> {
    const key = this.config.keyGenerator!(req)
    const count = this.store.increment(key, this.config.windowMs)
    
    // ヘッダーに情報を追加
    const headers = new Headers()
    headers.set('X-RateLimit-Limit', this.config.maxRequests.toString())
    headers.set('X-RateLimit-Remaining', Math.max(0, this.config.maxRequests - count).toString())
    headers.set('X-RateLimit-Reset', new Date(Date.now() + this.config.windowMs).toISOString())
    
    // 制限超過
    if (count > this.config.maxRequests) {
      const retryAfter = Math.ceil(this.config.windowMs / 1000)
      headers.set('Retry-After', retryAfter.toString())
      
      logger.warn('Rate limit exceeded', {
        key,
        count,
        limit: this.config.maxRequests,
        ip: req.headers.get('x-forwarded-for')
      })
      
      const error = AppError.rateLimitExceeded(retryAfter)
      return NextResponse.json(
        error.toJSON(),
        { 
          status: 429,
          headers
        }
      )
    }
    
    return null
  }
  
  /**
   * ミドルウェアとして使用
   */
  middleware() {
    return async (req: NextRequest) => {
      return await this.check(req)
    }
  }
}

// プリセット設定
export const rateLimiters = {
  // API全般: 60リクエスト/分
  api: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60
  }),
  
  // Webhook: 100リクエスト/分（LINEからの大量メッセージ対応）
  webhook: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100
  }),
  
  // コード生成: 10リクエスト/分（重い処理）
  codeGeneration: new RateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyGenerator: (req) => {
      // ユーザーIDベースの制限
      const userId = req.headers.get('x-user-id') || 
                    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    'unknown'
      return `code-gen:${userId}`
    }
  }),
  
  // 認証試行: 5回/5分
  auth: new RateLimiter({
    windowMs: 5 * 60 * 1000,
    maxRequests: 5,
    skipSuccessfulRequests: true // 成功した認証はカウントしない
  })
}