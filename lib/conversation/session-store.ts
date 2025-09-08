import { ConversationContext } from './conversational-flow'
import { logger } from '../utils/logger'
import { memoryManager } from '../utils/memory-manager'
import { SessionQueries } from '../supabase/session-queries'

// 会話セッションの永続化とタイムアウト管理
export class ConversationSessionStore {
  private static instance: ConversationSessionStore
  private sessions: Map<string, {
    context: ConversationContext
    lastActivity: number
    timeoutTimer?: NodeJS.Timeout
  }>
  
  // 15分のタイムアウト（メモリ節約のため短縮）
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000 // 1時間に延長（修正のため）
  // 最大保持セッション数（メモリ節約のため削減）
  private readonly MAX_SESSIONS = 30
  // クリーンアップタイマーの参照を保持
  private cleanupTimer?: NodeJS.Timeout
  
  private constructor() {
    // MemoryManagerを使用してキャッシュを作成
    this.sessions = memoryManager.createCache<{
      context: ConversationContext
      lastActivity: number
      timeoutTimer?: NodeJS.Timeout
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
      sessionCount: this.sessions.size 
    })
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    
    // すべてのセッションタイマーをクリア
    let clearedTimers = 0
    this.sessions.forEach((session) => {
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer)
        clearedTimers++
      }
    })
    
    logger.info('Cleared session timers', { clearedTimers })
    
    memoryManager.clearCache('conversation-sessions')
    this.sessions.clear()
    ConversationSessionStore.instance = null as any
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
    // アクセス時にクリーンアップを実行（Serverless対応）
    if (Math.random() < 0.1) { // 10%の確率でクリーンアップ
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
        lastActivity: Date.now(),
        timeoutTimer: this.createTimeoutTimer(userId)
      })
      
      logger.debug('Session loaded from database', { userId })
      return dbContext
    }
    
    return null
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
    return setTimeout(() => {
      this.delete(userId)
      logger.info('Session auto-deleted after timeout', { userId })
    }, this.SESSION_TIMEOUT)
  }
  
  /**
   * セッションの保存（Supabaseとメモリに保存）
   */
  set(userId: string, context: ConversationContext): void {
    // 同期版として動作
    this.setSync(userId, context)
  }
  
  async setAsync(userId: string, context: ConversationContext): Promise<void> {
    // セッション数制限チェック
    if (this.sessions.size >= this.MAX_SESSIONS && !this.sessions.has(userId)) {
      // 最も古いセッションを削除
      const oldestUserId = this.findOldestSession()
      if (oldestUserId) {
        this.delete(oldestUserId)
        logger.info('Deleted oldest session due to limit', { userId: oldestUserId })
      }
    }
    
    const existingSession = this.sessions.get(userId)
    
    // 既存のタイマーをクリア
    if (existingSession?.timeoutTimer) {
      clearTimeout(existingSession.timeoutTimer)
    }
    
    // 新しいタイマーを設定
    const timeoutTimer = setTimeout(() => {
      this.delete(userId)
      logger.info('Session auto-deleted after timeout', { userId })
    }, this.SESSION_TIMEOUT)
    
    this.sessions.set(userId, {
      context,
      lastActivity: Date.now(),
      timeoutTimer
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
    
    if (existingSession?.timeoutTimer) {
      clearTimeout(existingSession.timeoutTimer)
    }
    
    const timeoutTimer = this.createTimeoutTimer(userId)
    
    this.sessions.set(userId, {
      context,
      lastActivity: Date.now(),
      timeoutTimer
    })
    
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
    // 同期版として動作
    const session = this.sessions.get(userId)
    
    if (session?.timeoutTimer) {
      clearTimeout(session.timeoutTimer)
    }
    
    this.sessions.delete(userId)
    
    // Supabaseからも削除（非同期、エラーは無視）
    SessionQueries.deleteSession(userId).catch(error => {
      logger.error('Failed to delete session from database', { userId, error })
    })
    
    logger.debug('Session deleted', { userId })
  }
  
  async deleteAsync(userId: string): Promise<void> {
    const session = this.sessions.get(userId)
    
    if (session?.timeoutTimer) {
      clearTimeout(session.timeoutTimer)
    }
    
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
    
    // 既存のタイマーをクリア
    if (session.timeoutTimer) {
      clearTimeout(session.timeoutTimer)
    }
    
    // 新しいタイマーを設定
    session.timeoutTimer = setTimeout(() => {
      this.delete(userId)
      logger.info('Session auto-deleted after timeout', { userId })
    }, this.SESSION_TIMEOUT)
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