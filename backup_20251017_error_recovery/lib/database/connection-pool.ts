import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/lib/utils/logger'
import { RetryHandler } from '@/lib/utils/retry-handler'

export interface PoolConfig {
  maxConnections?: number
  minConnections?: number
  connectionTimeout?: number
  idleTimeout?: number
  retryAttempts?: number
}

interface PooledConnection {
  client: SupabaseClient
  inUse: boolean
  lastUsed: number
  createdAt: number
  useCount: number
}

export class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool | null = null
  private connections: PooledConnection[] = []
  private waitingQueue: Array<(client: SupabaseClient) => void> = []
  private config: Required<PoolConfig>
  private healthCheckInterval: NodeJS.Timeout | null = null
  private cleanupInterval: NodeJS.Timeout | null = null

  private constructor(config: PoolConfig = {}) {
    this.config = {
      maxConnections: config.maxConnections || 10,
      minConnections: config.minConnections || 2,
      connectionTimeout: config.connectionTimeout || 30000,
      idleTimeout: config.idleTimeout || 300000, // 5分
      retryAttempts: config.retryAttempts || 3
    }

    this.initialize()
  }

  static getInstance(config?: PoolConfig): DatabaseConnectionPool {
    if (!this.instance) {
      this.instance = new DatabaseConnectionPool(config)
    }
    return this.instance
  }

  /**
   * プールの初期化
   */
  private async initialize(): Promise<void> {
    // 最小接続数を作成
    for (let i = 0; i < this.config.minConnections; i++) {
      await this.createConnection()
    }

    // ヘルスチェックを開始（1分ごと）
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, 60000)

    // クリーンアップを開始（30秒ごと）
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections()
    }, 30000)

    logger.info('Database connection pool initialized', {
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections
    })
  }

  /**
   * 新しい接続を作成
   */
  private async createConnection(useServiceKey = false): Promise<PooledConnection | null> {
    if (this.connections.length >= this.config.maxConnections) {
      return null
    }

    try {
      // Use service key for write operations, anon key for read operations
      const apiKey = useServiceKey
        ? process.env.SUPABASE_SERVICE_ROLE_KEY!
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        apiKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false
          },
          global: {
            fetch: fetch.bind(globalThis)
          }
        }
      )

      const connection: PooledConnection = {
        client,
        inUse: false,
        lastUsed: Date.now(),
        createdAt: Date.now(),
        useCount: 0
      }

      this.connections.push(connection)
      
      logger.debug('Database connection created', {
        totalConnections: this.connections.length
      })

      return connection
    } catch (error) {
      logger.error('Failed to create database connection', { error })
      return null
    }
  }

  /**
   * 接続を取得 (読み込み用 - anon key)
   */
  async acquire(): Promise<SupabaseClient> {
    // 利用可能な接続を探す
    const available = this.connections.find(conn => !conn.inUse)
    
    if (available) {
      available.inUse = true
      available.lastUsed = Date.now()
      available.useCount++
      return available.client
    }

    // 新しい接続を作成
    if (this.connections.length < this.config.maxConnections) {
      const newConnection = await this.createConnection()
      if (newConnection) {
        newConnection.inUse = true
        return newConnection.client
      }
    }

    // 接続待ちキューに追加
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.waitingQueue.indexOf(resolve)
        if (index > -1) {
          this.waitingQueue.splice(index, 1)
        }
        reject(new Error('Connection timeout'))
      }, this.config.connectionTimeout)

      const wrappedResolve = (client: SupabaseClient) => {
        clearTimeout(timeout)
        resolve(client)
      }

      this.waitingQueue.push(wrappedResolve)
    })
  }

  /**
   * サービスキー接続を取得 (書き込み用 - service role key)
   */
  async acquireServiceClient(): Promise<SupabaseClient> {
    // サービスキー用の新しい接続を作成
    const newConnection = await this.createConnection(true)
    if (newConnection) {
      newConnection.inUse = true
      return newConnection.client
    }

    throw new Error('Failed to acquire service role connection')
  }

  /**
   * 接続を解放
   */
  release(client: SupabaseClient): void {
    const connection = this.connections.find(conn => conn.client === client)
    
    if (!connection) {
      logger.warn('Attempted to release unknown connection')
      return
    }

    // アトミックな操作として実行（レースコンディション対策）
    const resolve = this.waitingQueue.shift()
    
    if (resolve) {
      // 同じ接続を即座に再利用
      connection.useCount++
      resolve(client)
    } else {
      // 待機中のリクエストがない場合のみ解放
      connection.inUse = false
      connection.lastUsed = Date.now()
    }
  }

  /**
   * トランザクション実行のラッパー (anon key)
   */
  async executeWithConnection<T>(
    callback: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.acquire()

    try {
      return await RetryHandler.execute(
        () => callback(client),
        {
          maxAttempts: this.config.retryAttempts,
          onRetry: (attempt, error) => {
            logger.warn('Database operation retry', {
              attempt,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      )
    } finally {
      this.release(client)
    }
  }

  /**
   * サービスキー接続でのトランザクション実行
   */
  async executeWithServiceConnection<T>(
    callback: (client: SupabaseClient) => Promise<T>
  ): Promise<T> {
    const client = await this.acquireServiceClient()

    try {
      return await RetryHandler.execute(
        () => callback(client),
        {
          maxAttempts: this.config.retryAttempts,
          onRetry: (attempt, error) => {
            logger.warn('Database service operation retry', {
              attempt,
              error: error instanceof Error ? error.message : String(error)
            })
          }
        }
      )
    } finally {
      this.release(client)
    }
  }

  /**
   * ヘルスチェック
   */
  private async performHealthCheck(): Promise<void> {
    const unhealthyConnections: PooledConnection[] = []

    for (const connection of this.connections) {
      if (connection.inUse) continue

      try {
        // シンプルなクエリでヘルスチェック
        const { error } = await connection.client
          .from('generation_queue')
          .select('id')
          .limit(1)
        
        if (error) {
          unhealthyConnections.push(connection)
        }
      } catch (error) {
        unhealthyConnections.push(connection)
      }
    }

    // 不健全な接続を削除
    for (const unhealthy of unhealthyConnections) {
      this.removeConnection(unhealthy)
      logger.warn('Removed unhealthy connection', {
        useCount: unhealthy.useCount,
        age: Date.now() - unhealthy.createdAt
      })
    }

    // 最小接続数を維持
    while (this.connections.length < this.config.minConnections) {
      await this.createConnection()
    }
  }

  /**
   * アイドル接続のクリーンアップ
   */
  private cleanupIdleConnections(): void {
    const now = Date.now()
    const toRemove: PooledConnection[] = []

    for (const connection of this.connections) {
      // 最小接続数は維持
      if (this.connections.length <= this.config.minConnections) {
        break
      }

      // アイドルタイムアウトチェック
      if (!connection.inUse && 
          now - connection.lastUsed > this.config.idleTimeout) {
        toRemove.push(connection)
      }
    }

    for (const connection of toRemove) {
      this.removeConnection(connection)
      logger.debug('Removed idle connection', {
        idleTime: now - connection.lastUsed,
        useCount: connection.useCount
      })
    }
  }

  /**
   * 接続を削除
   */
  private removeConnection(connection: PooledConnection): void {
    const index = this.connections.indexOf(connection)
    if (index > -1) {
      this.connections.splice(index, 1)
    }
  }

  /**
   * プールの統計情報
   */
  getStats(): {
    total: number
    inUse: number
    idle: number
    waiting: number
    avgUseCount: number
  } {
    const inUse = this.connections.filter(c => c.inUse).length
    const totalUseCount = this.connections.reduce((sum: number, c) => sum + c.useCount, 0)
    
    return {
      total: this.connections.length,
      inUse,
      idle: this.connections.length - inUse,
      waiting: this.waitingQueue.length,
      avgUseCount: this.connections.length > 0 
        ? Math.round(totalUseCount / this.connections.length)
        : 0
    }
  }

  /**
   * プールの破棄
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    this.connections = []
    this.waitingQueue = []
    DatabaseConnectionPool.instance = null

    logger.info('Database connection pool destroyed')
  }
}