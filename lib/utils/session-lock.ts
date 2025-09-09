/**
 * セッション操作の競合状態を防ぐためのロック機構
 * アトミックな操作を保証
 */

import { logger } from './logger'
import { SecureRandom } from './secure-random'

interface LockInfo {
  lockId: string
  userId: string
  timestamp: number
  operation: string
}

export class SessionLock {
  private static locks: Map<string, LockInfo> = new Map()
  private static waitQueue: Map<string, Array<() => void>> = new Map()
  private static readonly LOCK_TIMEOUT = 5000 // 5秒でタイムアウト
  private static readonly MAX_WAIT_TIME = 10000 // 最大10秒待機
  private static cleanupTimer?: NodeJS.Timeout

  /**
   * ロックの取得（非同期）
   */
  static async acquire(
    userId: string,
    operation: string = 'unknown',
    timeout: number = this.MAX_WAIT_TIME
  ): Promise<string> {
    const lockId = SecureRandom.generateString(16)
    const startTime = Date.now()

    // クリーンアップタイマーの開始
    this.startCleanupTimer()

    while (Date.now() - startTime < timeout) {
      // 既存ロックのチェック
      const existingLock = this.locks.get(userId)
      
      if (!existingLock) {
        // ロックが存在しない場合は取得
        this.locks.set(userId, {
          lockId,
          userId,
          timestamp: Date.now(),
          operation
        })
        
        logger.debug('Lock acquired', { userId, lockId, operation })
        return lockId
      }

      // タイムアウトしたロックは強制解放
      if (Date.now() - existingLock.timestamp > this.LOCK_TIMEOUT) {
        logger.warn('Force releasing timed out lock', {
          userId,
          oldLockId: existingLock.lockId,
          operation: existingLock.operation
        })
        
        this.locks.set(userId, {
          lockId,
          userId,
          timestamp: Date.now(),
          operation
        })
        
        return lockId
      }

      // 待機
      await this.wait(userId, 100)
    }

    throw new Error(`Failed to acquire lock for user ${userId} after ${timeout}ms`)
  }

  /**
   * ロックの即座取得（失敗時は即座にfalseを返す）
   */
  static tryAcquire(userId: string, operation: string = 'unknown'): string | null {
    const existingLock = this.locks.get(userId)
    
    if (existingLock && Date.now() - existingLock.timestamp <= this.LOCK_TIMEOUT) {
      return null
    }

    const lockId = SecureRandom.generateString(16)
    this.locks.set(userId, {
      lockId,
      userId,
      timestamp: Date.now(),
      operation
    })

    logger.debug('Lock acquired (try)', { userId, lockId, operation })
    return lockId
  }

  /**
   * ロックの解放
   */
  static release(userId: string, lockId: string): boolean {
    const lock = this.locks.get(userId)
    
    if (!lock) {
      logger.debug('No lock to release', { userId })
      return false
    }

    if (lock.lockId !== lockId) {
      logger.warn('Lock ID mismatch on release', {
        userId,
        providedLockId: lockId,
        actualLockId: lock.lockId
      })
      return false
    }

    this.locks.delete(userId)
    
    // 待機中のコールバックを実行
    const waiters = this.waitQueue.get(userId)
    if (waiters && waiters.length > 0) {
      const callback = waiters.shift()
      if (callback) {
        setImmediate(callback)
      }
      
      if (waiters.length === 0) {
        this.waitQueue.delete(userId)
      }
    }

    logger.debug('Lock released', { userId, lockId })
    return true
  }

  /**
   * ロック付き操作の実行
   */
  static async withLock<T>(
    userId: string,
    operation: string,
    callback: () => Promise<T>
  ): Promise<T> {
    const lockId = await this.acquire(userId, operation)
    
    try {
      return await callback()
    } finally {
      this.release(userId, lockId)
    }
  }

  /**
   * 待機処理
   */
  private static wait(userId: string, ms: number): Promise<void> {
    return new Promise(resolve => {
      // 待機キューに追加
      if (!this.waitQueue.has(userId)) {
        this.waitQueue.set(userId, [])
      }
      
      const queue = this.waitQueue.get(userId)!
      
      // タイムアウト付き待機
      const timer = setTimeout(resolve, ms)
      
      const callback = () => {
        clearTimeout(timer)
        resolve()
      }
      
      queue.push(callback)
    })
  }

  /**
   * 定期的なクリーンアップ
   */
  private static startCleanupTimer(): void {
    if (this.cleanupTimer) return

    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const toRemove: string[] = []

      for (const [userId, lock] of this.locks.entries()) {
        if (now - lock.timestamp > this.LOCK_TIMEOUT * 2) {
          toRemove.push(userId)
        }
      }

      for (const userId of toRemove) {
        logger.warn('Removing stale lock', {
          userId,
          lock: this.locks.get(userId)
        })
        this.locks.delete(userId)
      }

      // ロックが空になったらタイマーを停止
      if (this.locks.size === 0) {
        this.stopCleanupTimer()
      }
    }, this.LOCK_TIMEOUT)
  }

  /**
   * クリーンアップタイマーの停止
   */
  private static stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
  }

  /**
   * 全ロックのクリア（テスト用）
   */
  static clear(): void {
    this.locks.clear()
    this.waitQueue.clear()
    this.stopCleanupTimer()
  }

  /**
   * 統計情報の取得
   */
  static getStats(): {
    activeLocks: number
    waitingQueues: number
    locks: Array<{ userId: string; operation: string; age: number }>
  } {
    const now = Date.now()
    
    return {
      activeLocks: this.locks.size,
      waitingQueues: this.waitQueue.size,
      locks: Array.from(this.locks.entries()).map(([userId, lock]) => ({
        userId,
        operation: lock.operation,
        age: now - lock.timestamp
      }))
    }
  }
}

/**
 * 分散ロック（Redis/Database使用時の実装）
 */
export class DistributedLock {
  /**
   * Redisベースのロック取得
   */
  static async acquireRedis(
    key: string,
    ttl: number = 5000
  ): Promise<string | null> {
    // Redis実装の場合
    // const lockId = SecureRandom.generateString(16)
    // const result = await redis.set(
    //   `lock:${key}`,
    //   lockId,
    //   'PX', ttl,
    //   'NX'
    // )
    // return result ? lockId : null

    // 現在はメモリベース実装を使用
    return SessionLock.tryAcquire(key, 'redis-lock')
  }

  /**
   * データベースベースのロック取得（アドバイザリーロック）
   */
  static async acquireDatabase(
    connection: any,
    key: string,
    timeout: number = 5000
  ): Promise<boolean> {
    // PostgreSQL アドバイザリーロック
    // const lockId = this.hashKey(key)
    // const query = 'SELECT pg_try_advisory_lock($1)'
    // const result = await connection.query(query, [lockId])
    // return result.rows[0].pg_try_advisory_lock

    // 現在はメモリベース実装を使用
    const lockId = SessionLock.tryAcquire(key, 'db-lock')
    return lockId !== null
  }

  /**
   * キーのハッシュ化（数値IDへの変換）
   */
  private static hashKey(key: string): number {
    let hash = 0
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash)
  }
}