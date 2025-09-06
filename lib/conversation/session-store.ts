import { ConversationContext } from './conversational-flow'
import { logger } from '../utils/logger'
import { memoryManager } from '../utils/memory-manager'

// 会話セッションの永続化とタイムアウト管理
export class ConversationSessionStore {
  private static instance: ConversationSessionStore
  private sessions: Map<string, {
    context: ConversationContext
    lastActivity: number
    timeoutTimer?: NodeJS.Timeout
  }>
  
  // 5分のタイムアウト（メモリ節約のため大幅短縮）
  private readonly SESSION_TIMEOUT = 5 * 60 * 1000
  // 最大保持セッション数（メモリ節約のため10に制限）
  private readonly MAX_SESSIONS = 10
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
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    // すべてのセッションタイマーをクリア
    this.sessions.forEach((session) => {
      if (session.timeoutTimer) {
        clearTimeout(session.timeoutTimer)
      }
    })
    memoryManager.clearCache('conversation-sessions')
    ConversationSessionStore.instance = null as any
  }
  
  static getInstance(): ConversationSessionStore {
    if (!this.instance) {
      this.instance = new ConversationSessionStore()
    }
    return this.instance
  }
  
  /**
   * セッションの取得
   */
  get(userId: string): ConversationContext | null {
    // アクセス時にクリーンアップを実行（Serverless対応）
    if (Math.random() < 0.1) { // 10%の確率でクリーンアップ
      this.cleanup()
    }
    
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
   * セッションの保存
   */
  set(userId: string, context: ConversationContext): void {
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
    
    logger.debug('Session saved', { 
      userId, 
      messagesCount: context.messages.length,
      category: context.category 
    })
  }
  
  /**
   * セッションの削除
   */
  delete(userId: string): void {
    const session = this.sessions.get(userId)
    
    if (session?.timeoutTimer) {
      clearTimeout(session.timeoutTimer)
    }
    
    this.sessions.delete(userId)
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