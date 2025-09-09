import { ConversationContext } from './conversational-flow'
import { logger } from '../utils/logger'
import { memoryManager } from '../utils/memory-manager'
import { SessionQueries } from '../supabase/session-queries'
import { CryptoUtils } from '../utils/crypto-utils'
import { SecureRandom } from '../utils/secure-random'

// タイマー管理クラス
class TimerManager {
  private timers: Map<string, NodeJS.Timeout> = new Map()
  
  set(key: string, callback: () => void, delay: number): void {
    this.clear(key)
    const timer = setTimeout(() => {
      this.timers.delete(key)
      callback()
    }, delay)
    this.timers.set(key, timer)
  }
  
  clear(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }
  
  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()
  }
  
  get size(): number {
    return this.timers.size
  }
}

// 会話セッションの永続化とタイムアウト管理
export class ConversationSessionStore {
  private static instance: ConversationSessionStore
  private sessions: Map<string, {
    context: ConversationContext
    lastActivity: number
  }>
  private sessionCache: Map<string, any> // memoryManagerのキャッシュ用
  private timerManager: TimerManager
  
  // 24時間のタイムアウト（ユーザー体験改善のため）
  private readonly SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24時間
  // 最大保持セッション数（メモリ節約のため削減）
  private readonly MAX_SESSIONS = 30
  
  private constructor() {
    // タイマーマネージャーを初期化
    this.timerManager = new TimerManager()
    
    // 通常のMapとして初期化
    this.sessions = new Map()
    
    // MemoryManagerを使用してキャッシュを作成（別途管理）
    this.sessionCache = memoryManager.createCache<{
      context: ConversationContext
      lastActivity: number
    }>('conversation-sessions', {
      maxSize: this.MAX_SESSIONS,
      ttl: this.SESSION_TIMEOUT,
      cleanupInterval: 10 * 60 * 1000
    })
    
    // ServerlessではsetIntervalを使わない
    // クリーンアップはアクセス時に実行
  }
  
  // インスタンスの破棄メソッドを追加
  destroy(): void {
    logger.info('Destroying session store', { 
      sessionCount: this.sessions.size,
      activeTimers: this.timerManager.size
    })
    
    // タイマーマネージャーで全タイマーをクリア
    this.timerManager.clearAll()
    
    logger.info('Cleared all timers')
    
    memoryManager.clearCache('conversation-sessions')
    this.sessions.clear()
    ConversationSessionStore.instance = null!
  }
  
  static getInstance(): ConversationSessionStore {
    if (!this.instance) {
      this.instance = new ConversationSessionStore()
    }
    return this.instance
  }
  
  /**
   * セッションの取得（Supabaseから取得、メモリキャッシュ付き）
   */
  get(userId: string): ConversationContext | null {
    // 同期版として動作（メモリキャッシュのみ使用）
    return this.getSync(userId)
  }
  
  async getAsync(userId: string): Promise<ConversationContext | null> {
    // SessionLockを使用して競合状態を防ぐ
    const { SessionLock } = await import('../utils/session-lock')
    
    return await SessionLock.withLock(userId, 'session-get', async () => {
      // アクセス時にクリーンアップを実行（Serverless対応）
      if (SecureRandom.random() < 0.1) { // 10%の確率でクリーンアップ
        this.cleanup()
      }
      
      // まずメモリキャッシュを確認
      const session = this.sessions.get(userId)
      
      if (session) {
        // タイムアウトチェック
        if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
          await this.delete(userId)
          logger.info('Session timed out', { userId })
          return null
        }
        
        // アクティビティを更新
        session.lastActivity = Date.now()
        this.resetTimeout(userId)
        
        return session.context
      }
      
      // メモリにない場合はSupabaseから取得
      const dbContext = await SessionQueries.getSession(userId)
      if (dbContext) {
        // メモリキャッシュに追加
        this.sessions.set(userId, {
          context: dbContext,
          lastActivity: Date.now()
        })
        
        // タイマーを設定
        this.createTimeoutTimer(userId)
        
        logger.debug('Session loaded from database', { userId })
        return dbContext
      }
      
      return null
    })
  }
  
  // 同期版（後方互換性のため残す）
  getSync(userId: string): ConversationContext | null {
    const session = this.sessions.get(userId)
    
    if (!session) {
      return null
    }
    
    // タイムアウトチェック
    if (Date.now() - session.lastActivity > this.SESSION_TIMEOUT) {
      this.delete(userId)
      logger.info('Session timed out', { userId })
      return null
    }
    
    // アクティビティを更新
    session.lastActivity = Date.now()
    this.resetTimeout(userId)
    
    return session.context
  }
  
  /**
   * タイマー作成ヘルパー
   */
  private createTimeoutTimer(userId: string): NodeJS.Timeout {
    // 既存タイマーをクリア（メモリリーク防止）
    this.timerManager.clear(userId)
    
    // 新しいタイマーを作成してTimerManagerに登録
    const timer = setTimeout(() => {
      this.delete(userId)
      logger.info('Session auto-deleted after timeout', { userId })
    }, this.SESSION_TIMEOUT)
    
    this.timerManager.set(userId, timer)
    return timer
  }
  
  /**
   * セッションの保存（Supabaseとメモリに保存）
   */
  set(userId: string, context: ConversationContext): void {
    // 同期版として動作
    this.setSync(userId, context)
  }
  
  async setAsync(userId: string, context: ConversationContext): Promise<void> {
    // SessionLockを使用して競合状態を防ぐ
    const { SessionLock } = await import('../utils/session-lock')
    
    await SessionLock.withLock(userId, 'session-set', async () => {
      // セッション固定化攻撃対策：既存セッションがある場合はセッションIDをローテート
      const existingSession = this.sessions.get(userId)
      if (existingSession && context.sessionId) {
        // 重要な操作時にセッションIDをローテート
        const isImportantOperation = context.currentStep === 4 || // コード生成時
                                    context.readyForCode === true // 生成準備完了時
        
        if (isImportantOperation) {
          const newSessionId = CryptoUtils.rotateSessionId(context.sessionId)
          context.sessionId = newSessionId
          logger.info('Session ID rotated for security', { 
            userId,
            operation: 'important_state_change' 
          })
        }
      }
      
      // 新規セッションの場合はセッションIDを生成
      if (!context.sessionId) {
        context.sessionId = CryptoUtils.generateTimestampedSessionId()
        logger.info('New session ID generated', { userId })
      }
      
      // セッション数制限チェック
      if (this.sessions.size >= this.MAX_SESSIONS && !this.sessions.has(userId)) {
        // 最も古いセッションを削除
        const oldestUserId = this.findOldestSession()
        if (oldestUserId) {
          this.delete(oldestUserId)
          logger.info('Deleted oldest session due to limit', { userId: oldestUserId })
        }
      }
      
      // タイマーをセット（TimerManagerが既存タイマーを自動クリア）
      this.createTimeoutTimer(userId)
      
      this.sessions.set(userId, {
        context,
        lastActivity: Date.now()
      })
      
      // Supabaseに保存（非同期、エラーは無視）
      SessionQueries.setSession(userId, context).catch(error => {
        logger.error('Failed to save session to database', { userId, error })
      })
      
      logger.debug('Session saved', { 
        userId, 
        messagesCount: context.messages.length,
        category: context.category 
      })
    })
  }
  
  // 同期版（後方互換性のため残す）
  setSync(userId: string, context: ConversationContext): void {
    // セッション数制限チェック
    if (this.sessions.size >= this.MAX_SESSIONS && !this.sessions.has(userId)) {
      const oldestUserId = this.findOldestSession()
      if (oldestUserId) {
        this.delete(oldestUserId)
        logger.info('Deleted oldest session due to limit', { userId: oldestUserId })
      }
    }
    
    const existingSession = this.sessions.get(userId)
    
    // 既存タイマーはTimerManagerが自動でクリア
    
    this.sessions.set(userId, {
      context,
      lastActivity: Date.now()
    })
    
    // タイマーをセット
    this.createTimeoutTimer(userId)
    
    // Supabaseに保存（非同期、エラーは無視）
    SessionQueries.setSession(userId, context).catch(error => {
      logger.error('Failed to save session to database', { userId, error })
    })
    
    logger.debug('Session saved (sync)', { 
      userId, 
      messagesCount: context.messages.length,
      category: context.category 
    })
  }
  
  /**
   * セッションの削除（Supabaseからも削除）
   */
  delete(userId: string): void {
    // タイマーをクリア
    this.timerManager.clear(userId)
    
    this.sessions.delete(userId)
    
    // Supabaseからも削除（非同期、エラーは無視）
    SessionQueries.deleteSession(userId).catch(error => {
      logger.error('Failed to delete session from database', { userId, error })
    })
    
    logger.debug('Session deleted', { userId })
  }
  
  async deleteAsync(userId: string): Promise<void> {
    // タイマーをクリア
    this.timerManager.clear(userId)
    
    this.sessions.delete(userId)
    
    // Supabaseからも削除（非同期、エラーは無視）
    SessionQueries.deleteSession(userId).catch(error => {
      logger.error('Failed to delete session from database', { userId, error })
    })
    
    logger.debug('Session deleted', { userId })
  }
  
  /**
   * タイムアウトタイマーのリセット
   */
  private resetTimeout(userId: string): void {
    const session = this.sessions.get(userId)
    
    if (!session) return
    
    // TimerManagerを使用してタイマーをリセット
    this.createTimeoutTimer(userId)
  }
  
  /**
   * 最も古いセッションを見つける
   */
  private findOldestSession(): string | null {
    let oldestUserId: string | null = null
    let oldestTime = Date.now()
    
    for (const [userId, session] of this.sessions.entries()) {
      if (session.lastActivity < oldestTime) {
        oldestTime = session.lastActivity
        oldestUserId = userId
      }
    }
    
    return oldestUserId
  }
  
  /**
   * 定期クリーンアップ
   */
  private cleanup(): void {
    const now = Date.now()
    const toDelete: string[] = []
    
    for (const [userId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > this.SESSION_TIMEOUT) {
        toDelete.push(userId)
      }
    }
    
    for (const userId of toDelete) {
      this.delete(userId)
    }
    
    if (toDelete.length > 0) {
      logger.info('Cleaned up expired sessions', { count: toDelete.length })
    }
  }
  
  /**
   * セッション統計の取得
   */
  getStats(): {
    totalSessions: number
    activeSessions: number
    oldestSession: number | null
  } {
    const now = Date.now()
    let activeSessions = 0
    let oldestTime: number | null = null
    
    for (const session of this.sessions.values()) {
      if (now - session.lastActivity < 5 * 60 * 1000) { // 5分以内
        activeSessions++
      }
      
      if (oldestTime === null || session.lastActivity < oldestTime) {
        oldestTime = session.lastActivity
      }
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      oldestSession: oldestTime ? now - oldestTime : null
    }
  }
}