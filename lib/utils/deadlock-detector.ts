import { logger } from '@/lib/utils/logger'

interface LockInfo {
  id: string
  resource: string
  owner: string
  acquiredAt: number
  waitingFor?: string[]
  priority?: number
}

interface WaitingRequest {
  id: string
  resource: string
  requester: string
  requestedAt: number
  callback: (granted: boolean) => void
  timeout?: NodeJS.Timeout
}

export class DeadlockDetector {
  private static instance: DeadlockDetector | null = null
  private locks: Map<string, LockInfo> = new Map()
  private waitQueue: Map<string, WaitingRequest[]> = new Map()
  private lockOwners: Map<string, Set<string>> = new Map()
  private detectionInterval?: NodeJS.Timeout
  private readonly DETECTION_INTERVAL = 5000 // 5秒
  private readonly DEFAULT_TIMEOUT = 30000 // 30秒

  private constructor() {
    this.startDetection()
  }

  static getInstance(): DeadlockDetector {
    if (!this.instance) {
      this.instance = new DeadlockDetector()
    }
    return this.instance
  }

  /**
   * ロックの取得試行
   */
  async acquireLock(
    resource: string,
    owner: string,
    options: {
      timeout?: number
      priority?: number
      nowait?: boolean
    } = {}
  ): Promise<boolean> {
    const lockId = `${owner}:${resource}:${Date.now()}`

    // 既存ロックのチェック
    const existingLock = this.locks.get(resource)
    if (!existingLock || existingLock.owner === owner) {
      // ロック取得可能
      this.grantLock(resource, owner, lockId, options.priority)
      return true
    }

    // nowaitモードの場合は即座に失敗
    if (options.nowait) {
      return false
    }

    // デッドロック検出
    if (this.detectDeadlock(owner, resource)) {
      logger.error('Deadlock detected', {
        owner,
        resource,
        currentLock: existingLock
      })
      throw new Error('Deadlock detected')
    }

    // 待機キューに追加
    return this.waitForLock(resource, owner, lockId, options.timeout || this.DEFAULT_TIMEOUT)
  }

  /**
   * ロックの解放
   */
  releaseLock(resource: string, owner: string): void {
    const lock = this.locks.get(resource)
    if (!lock || lock.owner !== owner) {
      logger.warn('Attempted to release unowned lock', { resource, owner })
      return
    }

    // ロックを削除
    this.locks.delete(resource)
    
    // オーナー情報を更新
    const ownedLocks = this.lockOwners.get(owner)
    if (ownedLocks) {
      ownedLocks.delete(resource)
      if (ownedLocks.size === 0) {
        this.lockOwners.delete(owner)
      }
    }

    logger.debug('Lock released', { resource, owner })

    // 待機中のリクエストを処理
    this.processWaitQueue(resource)
  }

  /**
   * ロックの付与
   */
  private grantLock(resource: string, owner: string, lockId: string, priority?: number): void {
    const lock: LockInfo = {
      id: lockId,
      resource,
      owner,
      acquiredAt: Date.now(),
      priority
    }

    this.locks.set(resource, lock)

    // オーナー情報を更新
    if (!this.lockOwners.has(owner)) {
      this.lockOwners.set(owner, new Set())
    }
    this.lockOwners.get(owner)!.add(resource)

    logger.debug('Lock granted', { resource, owner, lockId })
  }

  /**
   * ロック待機
   */
  private waitForLock(
    resource: string,
    requester: string,
    requestId: string,
    timeout: number
  ): Promise<boolean> {
    return new Promise((resolve) => {
      const request: WaitingRequest = {
        id: requestId,
        resource,
        requester,
        requestedAt: Date.now(),
        callback: resolve
      }

      // タイムアウト設定
      request.timeout = setTimeout(() => {
        this.removeFromWaitQueue(resource, requestId)
        logger.warn('Lock acquisition timeout', { resource, requester, timeout })
        resolve(false)
      }, timeout)

      // 待機キューに追加
      if (!this.waitQueue.has(resource)) {
        this.waitQueue.set(resource, [])
      }
      this.waitQueue.get(resource)!.push(request)

      logger.debug('Lock request queued', { resource, requester, requestId })
    })
  }

  /**
   * 待機キューの処理
   */
  private processWaitQueue(resource: string): void {
    const queue = this.waitQueue.get(resource)
    if (!queue || queue.length === 0) {
      return
    }

    // 優先度順にソート
    queue.sort((a, b) => {
      // FIFOをデフォルトとする
      return a.requestedAt - b.requestedAt
    })

    // 最初のリクエストを処理
    const request = queue.shift()!
    if (request.timeout) {
      clearTimeout(request.timeout)
    }

    // ロックを付与
    this.grantLock(resource, request.requester, request.id)
    request.callback(true)

    // キューが空になったら削除
    if (queue.length === 0) {
      this.waitQueue.delete(resource)
    }
  }

  /**
   * 待機キューから削除
   */
  private removeFromWaitQueue(resource: string, requestId: string): void {
    const queue = this.waitQueue.get(resource)
    if (!queue) return

    const index = queue.findIndex(r => r.id === requestId)
    if (index >= 0) {
      const request = queue[index]
      if (request.timeout) {
        clearTimeout(request.timeout)
      }
      queue.splice(index, 1)
    }

    if (queue.length === 0) {
      this.waitQueue.delete(resource)
    }
  }

  /**
   * デッドロック検出（単純な循環検出）
   */
  private detectDeadlock(requester: string, requestedResource: string): boolean {
    const visited = new Set<string>()
    const recursionStack = new Set<string>()

    // DFSで循環を検出
    const hasCycle = (owner: string): boolean => {
      visited.add(owner)
      recursionStack.add(owner)

      // このオーナーが待っているリソースを取得
      const waiting = this.getWaitingResources(owner)
      
      for (const resource of waiting) {
        const lock = this.locks.get(resource)
        if (!lock) continue

        const nextOwner = lock.owner
        
        if (!visited.has(nextOwner)) {
          if (hasCycle(nextOwner)) {
            return true
          }
        } else if (recursionStack.has(nextOwner)) {
          // 循環を検出
          return true
        }
      }

      recursionStack.delete(owner)
      return false
    }

    // 現在のリクエストを仮想的に追加して検証
    const currentLock = this.locks.get(requestedResource)
    if (currentLock && hasCycle(requester)) {
      return true
    }

    return false
  }

  /**
   * オーナーが待っているリソースを取得
   */
  private getWaitingResources(owner: string): Set<string> {
    const waiting = new Set<string>()
    
    for (const [resource, queue] of this.waitQueue.entries()) {
      if (queue.some(r => r.requester === owner)) {
        waiting.add(resource)
      }
    }

    return waiting
  }

  /**
   * 定期的なデッドロック検出
   */
  private startDetection(): void {
    this.detectionInterval = setInterval(() => {
      this.detectAndResolveDeadlocks()
    }, this.DETECTION_INTERVAL)
  }

  /**
   * デッドロックの検出と解決
   */
  private detectAndResolveDeadlocks(): void {
    const deadlocks = this.findDeadlocks()
    
    if (deadlocks.length > 0) {
      logger.error('Deadlocks detected', {
        count: deadlocks.length,
        cycles: deadlocks
      })

      // 最も優先度の低いロックを解放してデッドロックを解決
      for (const cycle of deadlocks) {
        this.resolveDeadlock(cycle)
      }
    }
  }

  /**
   * すべてのデッドロックを検出
   */
  private findDeadlocks(): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()

    for (const owner of this.lockOwners.keys()) {
      if (!visited.has(owner)) {
        const cycle = this.findCycle(owner, visited)
        if (cycle.length > 0) {
          cycles.push(cycle)
        }
      }
    }

    return cycles
  }

  /**
   * 循環を検出
   */
  private findCycle(start: string, visited: Set<string>): string[] {
    const path: string[] = []
    const recursionStack = new Set<string>()

    const dfs = (owner: string): boolean => {
      visited.add(owner)
      recursionStack.add(owner)
      path.push(owner)

      const waiting = this.getWaitingResources(owner)
      for (const resource of waiting) {
        const lock = this.locks.get(resource)
        if (!lock) continue

        const nextOwner = lock.owner
        if (recursionStack.has(nextOwner)) {
          // 循環を発見
          return true
        }

        if (!visited.has(nextOwner)) {
          if (dfs(nextOwner)) {
            return true
          }
        }
      }

      path.pop()
      recursionStack.delete(owner)
      return false
    }

    if (dfs(start)) {
      return path
    }

    return []
  }

  /**
   * デッドロックの解決
   */
  private resolveDeadlock(cycle: string[]): void {
    // 最も新しいロックを持つオーナーを犠牲にする
    let victim: string | null = null
    let latestTime = 0

    for (const owner of cycle) {
      const locks = this.lockOwners.get(owner)
      if (!locks) continue

      for (const resource of locks) {
        const lock = this.locks.get(resource)
        if (lock && lock.acquiredAt > latestTime) {
          latestTime = lock.acquiredAt
          victim = owner
        }
      }
    }

    if (victim) {
      logger.warn('Resolving deadlock by releasing locks', { victim, cycle })
      this.releaseAllLocks(victim)
    }
  }

  /**
   * オーナーのすべてのロックを解放
   */
  private releaseAllLocks(owner: string): void {
    const locks = this.lockOwners.get(owner)
    if (!locks) return

    for (const resource of Array.from(locks)) {
      this.releaseLock(resource, owner)
    }
  }

  /**
   * 統計情報の取得
   */
  getStats(): {
    activeLocks: number
    waitingRequests: number
    owners: number
    averageWaitTime: number
  } {
    let totalWaitTime = 0
    let waitCount = 0
    const now = Date.now()

    for (const queue of this.waitQueue.values()) {
      for (const request of queue) {
        totalWaitTime += now - request.requestedAt
        waitCount++
      }
    }

    return {
      activeLocks: this.locks.size,
      waitingRequests: waitCount,
      owners: this.lockOwners.size,
      averageWaitTime: waitCount > 0 ? totalWaitTime / waitCount : 0
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
    }

    // すべてのタイムアウトをクリア
    for (const queue of this.waitQueue.values()) {
      for (const request of queue) {
        if (request.timeout) {
          clearTimeout(request.timeout)
        }
      }
    }

    this.locks.clear()
    this.waitQueue.clear()
    this.lockOwners.clear()
    DeadlockDetector.instance = null
  }
}

export const deadlockDetector = DeadlockDetector.getInstance()