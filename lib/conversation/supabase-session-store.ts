import { createClient } from '@supabase/supabase-js'
import { ConversationContext } from './conversational-flow'
import { logger } from '@/lib/utils/logger'
import { generateSessionId } from '@/lib/utils/crypto'

export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  metadata?: any
}

export interface ExtractedRequirements {
  purpose?: string
  frequency?: string
  trigger?: string
  dataSource?: string
  dataTarget?: string
  operations?: string[]
  conditions?: string[]
  errorHandling?: string
  specialRequirements?: string[]
  userPreferences?: {
    logDetail?: string
    notifications?: string
    language?: string
  }
}

/**
 * Supabase を使用した永続的なセッション管理
 */
export class SupabaseSessionStore {
  private static instance: SupabaseSessionStore
  private supabase

  private constructor() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      // Supabase未設定の場合はダミーインスタンスを作成
      logger.warn('Supabase環境変数が未設定です。機能が制限されます。')
      this.supabase = null as any
      return
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    })
  }

  static getInstance(): SupabaseSessionStore {
    if (!this.instance) {
      this.instance = new SupabaseSessionStore()
    }
    return this.instance
  }

  /**
   * ユーザーの完全な会話コンテキストを取得
   */
  async getFullConversation(userId: string): Promise<ConversationContext | null> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, returning null')
      return null
    }

    try {
      // 1. コンテキスト取得（conversation_sessionsを使用）
      const { data: context, error: contextError } = await this.supabase
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (contextError) {
        if (contextError.code === 'PGRST116') {
          // レコードが存在しない
          logger.debug('No context found for user', { userId })
          return null
        }
        throw contextError
      }

      if (!context) return null

      // 2. 会話履歴取得（最新30件）
      const { data: messages, error: messagesError } = await this.supabase
        .from('conversations')
        .select('*')
        .eq('session_id', context.session_id_text || context.session_id)
        .order('message_index', { ascending: true })
        .limit(30)

      if (messagesError) {
        logger.error('Failed to fetch messages', { error: messagesError })
        throw messagesError
      }

      // 3. ConversationContext形式に変換
      const conversationContext: ConversationContext = {
        userId,  // userIdを追加
        category: context.category,
        subcategory: context.subcategory,
        messages: (messages || []).map((m: any) => ({
          role: m.role,
          content: m.content
        })),
        requirements: context.collected_requirements || context.requirements || {},
        extractedRequirements: context.extracted_requirements || {},
        readyForCode: context.ready_for_code || false,
        lastGeneratedCode: context.last_generated_code,
        lastGeneratedCategory: context.last_generated_category,
        lastGeneratedRequirements: context.last_generated_requirements,
        sessionId: context.session_id_text || context.session_id,
        isModifying: context.is_modifying,
        isAddingDescription: context.is_adding_description,
        waitingForScreenshot: context.waiting_for_screenshot,
        waitingForConfirmation: context.waiting_for_confirmation,
        imageContent: context.image_content,
        errorScreenshot: context.error_screenshot,
        currentStep: context.current_step
      }

      logger.info('Retrieved full conversation', {
        userId,
        sessionId: context.session_id_text || context.session_id,
        messageCount: messages?.length || 0,
        category: context.category
      })

      return conversationContext

    } catch (error) {
      logger.error('Failed to get full conversation', { userId, error })
      return null
    }
  }

  /**
   * メッセージを保存
   */
  async saveMessage(
    userId: string, 
    sessionId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ): Promise<void> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, skipping message save')
      return
    }

    try {
      // 最新のメッセージインデックスを取得
      const { data: lastMessage } = await this.supabase
        .from('conversations')
        .select('message_index')
        .eq('session_id', sessionId)
        .order('message_index', { ascending: false })
        .limit(1)
        .single()

      const nextIndex = (lastMessage?.message_index ?? -1) + 1

      // メッセージを保存
      const { error } = await this.supabase
        .from('conversations')
        .insert({
          user_id: userId,
          session_id: sessionId,
          message_index: nextIndex,
          role,
          content,
          metadata: metadata || {}
        })

      if (error) throw error

      logger.debug('Message saved', {
        userId,
        sessionId,
        role,
        messageIndex: nextIndex
      })

    } catch (error) {
      logger.error('Failed to save message', { userId, sessionId, error })
      throw error
    }
  }

  /**
   * コンテキストを更新
   */
  async updateContext(
    userId: string, 
    updates: Partial<ConversationContext>
  ): Promise<void> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, skipping context update')
      return
    }

    try {
      const updateData: any = {
        user_id: userId,
        updated_at: new Date().toISOString()
      }

      // ConversationContext から DB カラムへのマッピング
      if (updates.sessionId !== undefined) updateData.session_id_text = updates.sessionId
      if (updates.category !== undefined) updateData.category = updates.category
      if (updates.subcategory !== undefined) updateData.subcategory = updates.subcategory
      if (updates.requirements !== undefined) updateData.collected_requirements = updates.requirements
      if (updates.extractedRequirements !== undefined) updateData.extracted_requirements = updates.extractedRequirements
      if (updates.readyForCode !== undefined) updateData.ready_for_code = updates.readyForCode
      if (updates.lastGeneratedCode !== undefined) updateData.last_generated_code = updates.lastGeneratedCode
      if (updates.lastGeneratedCategory !== undefined) updateData.last_generated_category = updates.lastGeneratedCategory
      if (updates.lastGeneratedRequirements !== undefined) updateData.last_generated_requirements = updates.lastGeneratedRequirements
      if (updates.isModifying !== undefined) updateData.is_modifying = updates.isModifying
      if (updates.isAddingDescription !== undefined) updateData.is_adding_description = updates.isAddingDescription
      if (updates.waitingForScreenshot !== undefined) updateData.waiting_for_screenshot = updates.waitingForScreenshot
      if (updates.waitingForConfirmation !== undefined) updateData.waiting_for_confirmation = updates.waitingForConfirmation
      if (updates.imageContent !== undefined) updateData.image_content = updates.imageContent
      if (updates.errorScreenshot !== undefined) updateData.error_screenshot = updates.errorScreenshot
      if (updates.currentStep !== undefined) updateData.current_step = updates.currentStep

      // まず既存のセッションを検索
      const { data: existing, error: selectError } = await this.supabase
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .single()

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 はレコードが見つからない場合のコードなので無視
        throw selectError
      }

      if (existing) {
        // 既存セッションを更新
        const { error: updateError } = await this.supabase
          .from('conversation_sessions')
          .update(updateData)
          .eq('id', existing.id)

        if (updateError) throw updateError

        logger.debug('Context updated (existing session)', { userId, updates: Object.keys(updates) })
      } else {
        // 新規セッションを作成
        const { error: insertError } = await this.supabase
          .from('conversation_sessions')
          .insert({
            ...updateData,
            status: 'active',
            created_at: new Date().toISOString()
          })

        if (insertError) throw insertError

        logger.debug('Context created (new session)', { userId, updates: Object.keys(updates) })
      }

    } catch (error) {
      logger.error('Failed to update context', { userId, error })
      throw error
    }
  }

  /**
   * 新しいセッションを作成
   */
  async createNewSession(
    userId: string,
    category: string,
    initialMessage?: string,
    clearHistory: boolean = true  // デフォルトは履歴をクリア
  ): Promise<ConversationContext> {
    const sessionId = generateSessionId()  // TEXT型のセッションID生成

    if (!this.supabase) {
      logger.debug('Supabase not configured, returning local session')
      return {
        sessionId,
        userId,  // userIdを追加
        category,
        messages: initialMessage ? [{ role: 'user', content: initialMessage }] : [],
        requirements: {},
        extractedRequirements: {},
        readyForCode: false
      }
    }

    try {
      // sessionIdは上で生成済みなので削除
      
      // コンテキストを作成（conversation_sessions テーブルを使用）
      const contextData = {
        user_id: userId,
        session_id_text: sessionId,
        category,
        collected_requirements: {},
        extracted_requirements: {},
        ready_for_code: false,
        status: 'active',
        current_step: 0,
        messages: initialMessage ? [{role: 'user', content: initialMessage}] : [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      // clearHistoryがtrueの場合のみ、既存のセッションを削除
      if (clearHistory) {
        // messagesテーブルは存在しないためスキップ
        // 会話履歴はconversation_sessions.messagesカラム（JSONB）に保存されている

        await this.supabase
          .from('conversation_sessions')
          .delete()
          .eq('user_id', userId)
      } else {
        // 履歴を保持する場合は、既存セッションを非アクティブに
        await this.supabase
          .from('conversation_sessions')
          .update({ status: 'abandoned', updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('status', 'active')
      }

      // 新しいセッションを挿入
      const { error: contextError } = await this.supabase
        .from('conversation_sessions')
        .insert(contextData)

      if (contextError) throw contextError

      // 初期メッセージがある場合は保存
      if (initialMessage) {
        await this.saveMessage(userId, sessionId, 'user', initialMessage)
      }

      logger.info('New session created', { userId, sessionId, category })

      return {
        sessionId,
        category,
        messages: initialMessage ? [{ role: 'user', content: initialMessage }] : [],
        requirements: {},
        extractedRequirements: {},
        readyForCode: false
      }

    } catch (error) {
      logger.error('Failed to create new session', { userId, error })
      throw error
    }
  }

  /**
   * セッションを削除
   */
  async deleteSession(userId: string): Promise<void> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, skipping session delete')
      return
    }

    try {
      // messagesテーブルは存在しないためスキップ
      // 会話履歴はconversation_sessions.messagesカラム（JSONB）に保存されている

      // コンテキストを削除
      const { error } = await this.supabase
        .from('conversation_sessions')
        .delete()
        .eq('user_id', userId)

      if (error) throw error

      logger.info('Session and messages deleted', { userId })

    } catch (error) {
      logger.error('Failed to delete session', { userId, error })
      throw error
    }
  }

  /**
   * 会話履歴を取得（件数指定）
   */
  async getRecentMessages(
    userId: string,
    limit: number = 30
  ): Promise<Message[]> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, returning empty messages')
      return []
    }

    try {
      const { data: messages, error } = await this.supabase
        .from('conversations')
        .select('role, content, metadata')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      return (messages || []).reverse()

    } catch (error) {
      logger.error('Failed to get recent messages', { userId, error })
      return []
    }
  }

  /**
   * セッションのチェックポイントを作成
   */
  async createCheckpoint(
    userId: string,
    context: ConversationContext,
    checkpointType: string = 'auto'
  ): Promise<void> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, skipping checkpoint')
      return
    }

    try {
      const { error } = await this.supabase
        .from('session_checkpoints')
        .insert({
          user_id: userId,
          session_id: context.sessionId || generateSessionId(),
          context_snapshot: JSON.stringify(context),
          checkpoint_type: checkpointType,
          created_at: new Date().toISOString()
        })

      if (error) throw error

      logger.debug('Checkpoint created', { userId, checkpointType })

    } catch (error) {
      logger.error('Failed to create checkpoint', { userId, error })
    }
  }

  /**
   * セッションを復元
   */
  async recoverSession(userId: string): Promise<ConversationContext | null> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, cannot recover session')
      return null
    }

    try {
      // 最新のチェックポイントを取得
      const { data: checkpoint, error } = await this.supabase
        .from('session_checkpoints')
        .select('context_snapshot')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error || !checkpoint) {
        return this.getFullConversation(userId)
      }

      const recovered = JSON.parse(checkpoint.context_snapshot)
      logger.info('Session recovered from checkpoint', { userId })
      return recovered

    } catch (error) {
      logger.error('Failed to recover session', { userId, error })
      return null
    }
  }

  /**
   * 期限切れセッションをクリーンアップ
   */
  async cleanupExpiredSessions(): Promise<void> {
    if (!this.supabase) {
      logger.debug('Supabase not configured, skipping cleanup')
      return
    }

    try {
      const { error } = await this.supabase
        .rpc('cleanup_expired_sessions')

      if (error) throw error

      logger.info('Expired sessions cleaned up')

    } catch (error) {
      logger.error('Failed to cleanup expired sessions', { error })
    }
  }
}