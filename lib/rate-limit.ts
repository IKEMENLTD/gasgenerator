import { NextRequest } from 'next/server'

interface RateLimitStore {
  increment(key: string): Promise<{ count: number; ttl: number }>
  reset(key: string): Promise<void>
}

// Memory store for development/single instance
class MemoryStore implements RateLimitStore {
  private store = new Map<string, { count: number; expires: number }>()

  async increment(key: string): Promise<{ count: number; ttl: number }> {
    const now = Date.now()
    const record = this.store.get(key)

    if (!record || record.expires < now) {
      const expires = now + 60000 // 1 minute window
      this.store.set(key, { count: 1, expires })
      return { count: 1, ttl: 60 }
    }

    record.count++
    return {
      count: record.count,
      ttl: Math.ceil((record.expires - now) / 1000)
    }
  }

  async reset(key: string): Promise<void> {
    this.store.delete(key)
  }

  // Cleanup expired entries periodically
  cleanup() {
    const now = Date.now()
    for (const [key, record] of this.store.entries()) {
      if (record.expires < now) {
        this.store.delete(key)
      }
    }
  }
}

// Redis store for production
class RedisStore implements RateLimitStore {
  private redis: any

  constructor() {
    if (process.env.REDIS_URL) {
      // Dynamic import to avoid dependency issues in development
      import('ioredis').then(({ default: Redis }) => {
        this.redis = new Redis(process.env.REDIS_URL!)
      }).catch(() => {
        console.warn('Redis not available, falling back to memory store')
      })
    }
  }

  async increment(key: string): Promise<{ count: number; ttl: number }> {
    if (!this.redis) {
      return memoryStore.increment(key)
    }

    const multi = this.redis.multi()
    multi.incr(key)
    multi.ttl(key)
    multi.expire(key, 60) // 1 minute window

    const results = await multi.exec()
    const count = results[0][1]
    const ttl = results[1][1]

    return {
      count,
      ttl: ttl > 0 ? ttl : 60
    }
  }

  async reset(key: string): Promise<void> {
    if (!this.redis) {
      return memoryStore.reset(key)
    }
    await this.redis.del(key)
  }
}

// Singleton instances
const memoryStore = new MemoryStore()
const redisStore = new RedisStore()

// Use Redis if available, otherwise memory
const store: RateLimitStore = process.env.REDIS_URL ? redisStore : memoryStore

// Cleanup interval for memory store
if (!process.env.REDIS_URL) {
  setInterval(() => {
    (memoryStore as MemoryStore).cleanup()
  }, 60000) // Clean every minute
}

export interface RateLimitConfig {
  uniqueTokenPerInterval: number
  interval: number
  limit: number
}

export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig = {
    uniqueTokenPerInterval: 100,
    interval: 60000,
    limit: 10
  }
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
              request.headers.get('x-real-ip') ||
              'unknown'

  const key = `rate-limit:${ip}`
  const { count, ttl } = await store.increment(key)

  const remaining = Math.max(0, config.limit - count)
  const reset = Date.now() + (ttl * 1000)

  return {
    success: count <= config.limit,
    limit: config.limit,
    remaining,
    reset
  }
}

export async function resetRateLimit(request: NextRequest): Promise<void> {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
              request.headers.get('x-real-ip') ||
              'unknown'

  const key = `rate-limit:${ip}`
  await store.reset(key)
}