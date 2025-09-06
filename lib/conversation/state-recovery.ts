import { ConversationContext } from './conversational-flow'
import { supabaseAdmin } from '../supabase/admin-client'
import { logger } from '../utils/logger'

/**
 * Supabaseを使った簡易的な状態永続化
 * （Redisの代替案）
 */
export class StateRecovery {
  private static readonly TABLE_NAME = 'conversation_states'
  private static readonly MAX_AGE_MINUTES = 30
  
  /**
   * 会話状態を保存
   */
  static async saveState(
    userId: string, 
    context: ConversationContext
  ): Promise<void> {
    try {
      // 重要な情報のみ保存（メッセージ最新5件）
      const compactContext = {
        category: context.category,
        messages: context.messages.slice(-5), // 最新5件のみ
        requirements: context.requirements,
        readyForCode: context.readyForCode,
        lastActivity: new Date().toISOString()
      }
      
      const { error } = await supabaseAdmin
        .from(this.TABLE_NAME)
        .upsert({
          user_id: userId,
          context: compactContext,
          expires_at: new Date(Date.now() + this.MAX_AGE_MINUTES * 60 * 1000).toISOString()
        })
      
      if (error) {
        logger.error('Failed to save conversation state', { userId, error })
      }
    } catch (error) {
      // 保存失敗してもアプリは継続
      logger.error('State save error', { error })
    }
  }
  
  /**
   * 会話状態を復元
   */
  static async restoreState(userId: string): Promise<ConversationContext | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from(this.TABLE_NAME)
        .select('context')
        .eq('user_id', userId)
        .gt('expires_at', new Date().toISOString())
        .single()
      
      if (error || !data) {
        return null
      }
      
      // 復元した状態を返す
      return data.context as ConversationContext
      
    } catch (error) {
      logger.error('State restore error', { error })
      return null
    }
  }
  
  /**
   * 期限切れ状態をクリーンアップ
   */
  static async cleanup(): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from(this.TABLE_NAME)
        .delete()
        .lt('expires_at', new Date().toISOString())
      
      if (error) {
        logger.error('Cleanup error', { error })
      }
    } catch (error) {
      logger.error('State cleanup error', { error })
    }
  }
}

/**
 * メモリとDBのハイブリッドストア
 */
export class HybridSessionStore {
  private memoryStore: Map<string, ConversationContext> = new Map()
  private lastSave: Map<string, number> = new Map()
  private readonly SAVE_INTERVAL = 60000 // 1分ごとに保存
  
  /**
   * セッション取得（メモリ優先、なければDB）
   */
  async get(userId: string): Promise<ConversationContext | null> {
    // 1. メモリから取得
    const memoryContext = this.memoryStore.get(userId)
    if (memoryContext) {
      return memoryContext
    }
    
    // 2. DBから復元
    const restoredContext = await StateRecovery.restoreState(userId)
    if (restoredContext) {
      // メモリにキャッシュ
      this.memoryStore.set(userId, restoredContext)
      logger.info('Session restored from DB', { userId })
    }
    
    return restoredContext
  }
  
  /**
   * セッション保存（メモリ即座、DB遅延）
   */
  async set(userId: string, context: ConversationContext): Promise<void> {
    // 1. メモリに即座保存
    this.memoryStore.set(userId, context)
    
    // 2. DBへの保存は間隔を空ける
    const lastSave = this.lastSave.get(userId) || 0
    const now = Date.now()
    
    if (now - lastSave > this.SAVE_INTERVAL || context.readyForCode) {
      // 非同期でDB保存（ブロックしない）
      StateRecovery.saveState(userId, context).catch(err => 
        logger.error('Background save failed', { err })
      )
      this.lastSave.set(userId, now)
    }
  }
  
  /**
   * セッション削除
   */
  delete(userId: string): void {
    this.memoryStore.delete(userId)
    this.lastSave.delete(userId)
    
    // DBからも削除（非同期）
    supabaseAdmin
      .from('conversation_states')
      .delete()
      .eq('user_id', userId)
      .then(() => logger.debug('Session deleted from DB', { userId }))
      .catch(err => logger.error('DB delete failed', { err }))
  }
  
  /**
   * 統計情報
   */
  getStats(): {
    memoryCount: number
    savedCount: number
  } {
    return {
      memoryCount: this.memoryStore.size,
      savedCount: this.lastSave.size
    }
  }
}