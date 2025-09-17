import { ConversationContext } from './conversational-flow'
import { ConversationSessionStore } from './session-store'
import { SupabaseSessionStore } from './supabase-session-store'
import { logger } from '@/lib/utils/logger'

/**
 * セッション管理の統合クラス
 * Supabaseとメモリキャッシュの両方を管理し、フォールバック処理を提供
 */
export class SessionManager {
  private static instance: SessionManager
  private memoryStore: ConversationSessionStore
  private supabaseStore: SupabaseSessionStore
  private syncQueue: Map<string, Promise<void>> = new Map()

  private constructor() {
    this.memoryStore = ConversationSessionStore.getInstance()
    this.supabaseStore = SupabaseSessionStore.getInstance()
  }

  static getInstance(): SessionManager {
    if (!this.instance) {
      this.instance = new SessionManager()
    }
    return this.instance
  }

  /**
   * コンテキストを取得（キャッシュ優先、Supabaseフォールバック）
   */
  async getContext(userId: string): Promise<ConversationContext | null> {
    try {
      // 1. メモリキャッシュから取得を試みる
      let context = this.memoryStore.get(userId)
      
      if (context) {
        logger.debug('Context found in memory cache', { userId })
        return context
      }

      // 2. Supabaseから取得
      context = await this.withRetry(() => 
        this.supabaseStore.getFullConversation(userId),
        3
      )

      if (context) {
        // メモリキャッシュに保存
        this.memoryStore.set(userId, context)
        logger.info('Context loaded from Supabase', { 
          userId,
          messageCount: context.messages.length 
        })
      }

      return context

    } catch (error) {
      logger.error('Failed to get context', { userId, error })
      
      // 最終フォールバック：メモリキャッシュのみ
      return this.memoryStore.get(userId)
    }
  }

  /**
   * コンテキストを保存（両方に保存、エラー時はメモリのみ）
   */
  async saveContext(
    userId: string, 
    context: ConversationContext
  ): Promise<void> {
    // 1. メモリキャッシュに即座に保存
    this.memoryStore.set(userId, context)

    // 2. 非同期でSupabaseに保存（エラーを無視）
    this.enqueueSyncToSupabase(userId, context)
  }

  /**
   * メッセージを保存（バッチ処理対応）
   */
  async saveMessage(
    userId: string,
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: any
  ): Promise<void> {
    try {
      // Supabaseに保存を試みる
      await this.withRetry(() =>
        this.supabaseStore.saveMessage(userId, sessionId, role, content, metadata),
        2
      )
    } catch (error) {
      // エラーログのみ（処理は継続）
      logger.warn('Failed to save message to Supabase', { 
        userId, 
        error: error instanceof Error ? error.message : String(error) 
      })
    }
  }

  /**
   * 新しいセッションを作成
   */
  async createSession(
    userId: string,
    category: string,
    initialMessage?: string,
    clearHistory: boolean = true
  ): Promise<ConversationContext> {
    try {
      // Supabaseで作成を試みる
      const context = await this.withRetry(() =>
        this.supabaseStore.createNewSession(userId, category, initialMessage, clearHistory),
        2
      )

      // メモリキャッシュにも保存
      this.memoryStore.set(userId, context)
      
      return context

    } catch (error) {
      logger.error('Failed to create session in Supabase, using local', { userId, error })
      
      // ローカルでセッション作成
      const context: ConversationContext = {
        sessionId: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId,  // userIdを追加
        category,
        messages: initialMessage ? [{ role: 'user', content: initialMessage }] : [],
        requirements: {},
        readyForCode: false
      }
      
      this.memoryStore.set(userId, context)
      return context
    }
  }

  /**
   * セッションを削除
   */
  async deleteSession(userId: string): Promise<void> {
    // メモリから即座に削除
    this.memoryStore.delete(userId)

    // Supabaseからも削除（エラーは無視）
    try {
      await this.supabaseStore.deleteSession(userId)
    } catch (error) {
      logger.warn('Failed to delete session from Supabase', { userId, error })
    }
  }

  /**
   * Supabaseへの同期をキューに追加（バッチ処理）
   */
  private enqueueSyncToSupabase(
    userId: string,
    context: ConversationContext
  ): void {
    // 既存の同期タスクがあれば待機
    const existingSync = this.syncQueue.get(userId)
    
    const syncTask = (async () => {
      if (existingSync) {
        await existingSync
      }

      try {
        await this.supabaseStore.updateContext(userId, context)
        logger.debug('Context synced to Supabase', { userId })
      } catch (error) {
        logger.warn('Failed to sync context to Supabase', { 
          userId, 
          error: error instanceof Error ? error.message : String(error)
        })
      } finally {
        // タスク完了後にキューから削除
        this.syncQueue.delete(userId)
      }
    })()

    this.syncQueue.set(userId, syncTask)
  }

  /**
   * リトライ機能付き実行
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error | null = null

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        if (i < maxRetries - 1) {
          logger.debug('Retrying operation', { 
            attempt: i + 1, 
            maxRetries,
            error: lastError.message 
          })
          
          // 指数バックオフ
          await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)))
        }
      }
    }

    throw lastError || new Error('Max retries exceeded')
  }

  /**
   * チェックポイントを作成（バックグラウンド）
   */
  async createCheckpoint(userId: string): Promise<void> {
    const context = await this.getContext(userId)
    if (!context) return

    // バックグラウンドで実行
    this.supabaseStore.createCheckpoint(userId, context, 'manual')
      .catch(error => {
        logger.warn('Failed to create checkpoint', { userId, error })
      })
  }

  /**
   * セッションを復旧
   */
  async recoverSession(userId: string): Promise<ConversationContext | null> {
    try {
      // 1. チェックポイントから復旧を試みる
      const recovered = await this.supabaseStore.recoverSession(userId)
      
      if (recovered) {
        // メモリキャッシュに復元
        this.memoryStore.set(userId, recovered)
        logger.info('Session recovered from checkpoint', { userId })
        return recovered
      }

      // 2. 通常の取得を試みる
      return await this.getContext(userId)

    } catch (error) {
      logger.error('Failed to recover session', { userId, error })
      return null
    }
  }

  /**
   * 最近のメッセージを取得
   */
  async getRecentMessages(userId: string, limit: number = 30): Promise<any[]> {
    try {
      return await this.supabaseStore.getRecentMessages(userId, limit)
    } catch (error) {
      logger.warn('Failed to get recent messages', { userId, error })
      return []
    }
  }

  /**
   * 全セッションの統計情報を取得
   */
  getStats(): {
    memorySessions: number
    syncQueueSize: number
  } {
    return {
      memorySessions: 0,  // TODO: メモリストアの統計実装
      syncQueueSize: this.syncQueue.size
    }
  }
}