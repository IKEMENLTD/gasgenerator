import { supabaseAdmin } from './client'
import { logger } from '../utils/logger'
import type { ConversationContext } from '../conversation/conversational-flow'

export class SessionQueries {
  /**
   * セッションを取得（conversation_sessionsテーブルから）
   */
  static async getSession(userId: string): Promise<ConversationContext | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          // レコードが見つからない場合
          return null
        }
        logger.error('Failed to get session', { error, userId })
        return null
      }

      // データベースのカラムからConversationContextを構築
      if (data) {
        return {
          messages: data.messages || [],
          category: data.category,
          subcategory: data.subcategory,
          requirements: data.collected_requirements || {},
          extractedRequirements: data.collected_requirements || {},
          currentStep: data.current_step || 1,
          readyForCode: false,
          lastGeneratedCode: data.status === 'completed',
          sessionId: data.session_id_text
        } as ConversationContext
      }

      return null
    } catch (error) {
      logger.error('SessionQueries.getSession error', { error, userId })
      return null
    }
  }

  /**
   * セッションを保存または更新（conversation_sessionsテーブルに）
   */
  static async setSession(userId: string, context: ConversationContext): Promise<boolean> {
    try {
      // 既存のアクティブセッションを確認
      const { data: existing } = await supabaseAdmin
        .from('conversation_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      const sessionData = {
        user_id: userId,
        line_user_id: userId, // LINE User IDと同じ
        session_id_text: context.sessionId || `session_${Date.now()}`,
        messages: context.messages || [],
        category: context.category,
        subcategory: context.subcategory,
        collected_requirements: context.requirements || {},
        current_step: context.currentStep || 1,
        status: context.lastGeneratedCode ? 'completed' : 'active',
        updated_at: new Date().toISOString()
      }

      if (existing) {
        // 既存セッションを更新
        const { error } = await supabaseAdmin
          .from('conversation_sessions')
          .update(sessionData)
          .eq('id', existing.id)

        if (error) {
          logger.error('Failed to update session', { error, userId })
          return false
        }
      } else {
        // 新規セッションを作成
        const { error } = await supabaseAdmin
          .from('conversation_sessions')
          .insert({
            ...sessionData,
            created_at: new Date().toISOString()
          })

        if (error) {
          logger.error('Failed to insert session', { error, userId })
          return false
        }
      }

      logger.debug('Session saved to database', { userId })
      return true
    } catch (error) {
      logger.error('SessionQueries.setSession error', { error, userId })
      return false
    }
  }

  /**
   * セッションを削除（非アクティブ化）
   */
  static async deleteSession(userId: string): Promise<boolean> {
    try {
      // セッションを削除せず、非アクティブ化する
      const { error } = await supabaseAdmin
        .from('conversation_sessions')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'active')

      if (error) {
        logger.error('Failed to delete session', { error, userId })
        return false
      }

      logger.debug('Session deleted from database', { userId })
      return true
    } catch (error) {
      logger.error('SessionQueries.deleteSession error', { error, userId })
      return false
    }
  }

  /**
   * 期限切れセッションをクリーンアップ
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      // 1時間以上更新されていないセッションを非アクティブ化
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      
      const { data, error } = await supabaseAdmin
        .from('conversation_sessions')
        .update({ 
          status: 'inactive',
          updated_at: new Date().toISOString()
        })
        .eq('status', 'active')
        .lt('updated_at', oneHourAgo)
        .select()

      if (error) {
        logger.error('Failed to cleanup expired sessions', { error })
        return 0
      }

      const count = data?.length || 0
      if (count > 0) {
        logger.info('Cleaned up expired sessions', { count })
      }
      
      return count
    } catch (error) {
      logger.error('SessionQueries.cleanupExpiredSessions error', { error })
      return 0
    }
  }

  /**
   * アクティブなセッション数を取得
   */
  static async getActiveSessionCount(): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from('conversation_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      if (error) {
        logger.error('Failed to get active session count', { error })
        return 0
      }

      return count || 0
    } catch (error) {
      logger.error('SessionQueries.getActiveSessionCount error', { error })
      return 0
    }
  }
}