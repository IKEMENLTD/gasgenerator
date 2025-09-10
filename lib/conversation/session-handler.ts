import { UserQueries, SessionQueries } from '@/lib/supabase/queries'
import { logger } from '@/lib/utils/logger'
import { DATABASE_CONFIG } from '@/lib/constants/config'
import type { ConversationState } from '@/types/conversation'

export class SessionHandler {
  /**
   * ユーザーの現在の会話状態を取得
   */
  static async getCurrentState(lineUserId: string): Promise<ConversationState | null> {
    try {
      const user = await UserQueries.createOrUpdate(lineUserId)
      if (!user) return null

      const session = await SessionQueries.getSession((user as any).id || lineUserId)
      if (!session) return null

      return {
        userId: (user as any).id || lineUserId,
        sessionId: (session as any).id || '',
        currentStep: (session as any).current_step as 1 | 2 | 3,
        category: session.category || undefined,
        subcategory: (session as any).subcategory || undefined,
        requirements: (session as any).collected_requirements || session.requirements,
        status: (session as any).status || 'active'
      }

    } catch (error) {
      logger.error('Failed to get conversation state', { lineUserId, error })
      return null
    }
  }

  /**
   * 新しい会話セッションを開始
   */
  static async startNewSession(lineUserId: string, _displayName?: string): Promise<ConversationState> {
    try {
      // ユーザー取得または作成
      const user = await UserQueries.createOrUpdate(lineUserId)

      // 既存のアクティブセッションがあれば完了
      const existingSession = await SessionQueries.getSession((user as any).id || lineUserId)
      if (existingSession) {
        await SessionQueries.deleteSession((user as any).id || lineUserId)
        logger.info('Completed existing session', { 
          lineUserId, 
          sessionId: (existingSession as any).id || '' 
        })
      }

      // 新しいセッション作成
      await SessionQueries.setSession((user as any).id || lineUserId, {
        messages: [],
        category: '',
        requirements: {},
        readyForCode: false
      })

      logger.info('Started new conversation session', { 
        lineUserId, 
        userId: (user as any).id || lineUserId, 
        sessionId: lineUserId 
      })

      return {
        userId: (user as any).id || lineUserId,
        sessionId: lineUserId,
        currentStep: 1,
        requirements: {},
        status: 'active'
      }

    } catch (error) {
      logger.error('Failed to start new session', { lineUserId, error })
      throw error
    }
  }

  /**
   * セッションステップを進める
   */
  static async advanceStep(
    sessionId: string,
    stepData: {
      step?: 2 | 3
      category?: string
      subcategory?: string
      additionalRequirements?: Record<string, any>
    }
  ): Promise<ConversationState> {
    try {
      const session = await SessionQueries.getSession(sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      const currentRequirements = (session as any).collected_requirements || session.requirements || {}
      const updatedRequirements = {
        ...currentRequirements,
        ...stepData.additionalRequirements
      }

      await SessionQueries.setSession(sessionId, {
        ...session,
        category: stepData.category || session.category,
        requirements: updatedRequirements
      })
      
      const updatedSession = session

      logger.info('Advanced session step', { 
        sessionId, 
        fromStep: (session as any).current_step || 1,
        toStep: stepData.step || ((session as any).current_step || 1) + 1,
        category: stepData.category || session.category,
        subcategory: stepData.subcategory || (session as any).subcategory
      })

      return {
        userId: (updatedSession as any).user_id || sessionId,
        sessionId: (updatedSession as any).id || sessionId,
        currentStep: (stepData.step || ((session as any).current_step || 1) + 1) as 1 | 2 | 3,
        category: updatedSession.category || undefined,
        subcategory: (updatedSession as any).subcategory || undefined,
        requirements: updatedRequirements,
        status: (updatedSession as any).status || 'active'
      }

    } catch (error) {
      logger.error('Failed to advance session step', { sessionId, error })
      throw error
    }
  }

  /**
   * セッションを生成準備完了状態に更新
   */
  static async markReadyForGeneration(
    sessionId: string,
    finalRequirements: Record<string, any>
  ): Promise<void> {
    try {
      const currentSession = await SessionQueries.getSession(sessionId)
      if (currentSession) {
        await SessionQueries.setSession(sessionId, {
          ...currentSession,
          requirements: finalRequirements
        })
      }

      logger.info('Session marked ready for generation', { sessionId })

    } catch (error) {
      logger.error('Failed to mark session ready', { sessionId, error })
      throw error
    }
  }

  /**
   * セッションを完了
   */
  static async completeSession(sessionId: string): Promise<void> {
    try {
      await SessionQueries.deleteSession(sessionId)
      logger.info('Session completed', { sessionId })

    } catch (error) {
      logger.error('Failed to complete session', { sessionId, error })
      throw error
    }
  }

  /**
   * セッションを放棄（エラー時など）
   */
  static async abandonSession(sessionId: string, reason?: string): Promise<void> {
    try {
      await SessionQueries.deleteSession(sessionId)

      logger.warn('Session abandoned', { sessionId, reason })

    } catch (error) {
      logger.error('Failed to abandon session', { sessionId, error })
      throw error
    }
  }

  /**
   * 期限切れセッションのクリーンアップ
   */
  static async cleanupExpiredSessions(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - DATABASE_CONFIG.MAX_SESSION_AGE_HOURS * 60 * 60 * 1000)
      
      // 期限切れセッションを削除
      const { supabaseAdmin } = await import('@/lib/supabase/client')
      const { data: deletedSessions, error } = await supabaseAdmin
        .from('sessions')
        .delete()
        .lt('updated_at', cutoffTime.toISOString())
        .select('id')
      
      if (error) {
        logger.error('Failed to delete expired sessions', { error })
        return 0
      }
      
      const deletedCount = deletedSessions?.length || 0
      logger.info('Session cleanup completed', { cutoffTime, deletedCount })
      
      return deletedCount

    } catch (error) {
      logger.error('Session cleanup failed', { error })
      throw error
    }
  }

  /**
   * ユーザーの会話履歴統計を取得
   */
  static async getUserStats(lineUserId: string): Promise<{
    totalSessions: number
    completedSessions: number
    averageSteps: number
    lastActiveAt: string
  } | null> {
    try {
      const user = await UserQueries.createOrUpdate(lineUserId)
      if (!user) return null

      // 詳細な統計を取得
      const { supabaseAdmin } = await import('@/lib/supabase/client')
      const { data: sessionStats, error } = await supabaseAdmin
        .from('sessions')
        .select('status, step_data')
        .eq('user_id', (user as any).id || lineUserId)
      
      if (error) {
        logger.error('Failed to get session stats', { error })
        return {
          totalSessions: (user as any).total_requests || 0,
          completedSessions: 0,
          averageSteps: 0,
          lastActiveAt: (user as any).last_active_at || new Date().toISOString()
        }
      }
      
      const completedSessions = sessionStats?.filter((s: any) => s.status === 'completed').length || 0
      const totalSteps = sessionStats?.reduce((sum, s: any) => {
        const steps = s.step_data?.currentStep || 0
        return sum + steps
      }, 0) || 0
      const averageSteps = sessionStats?.length ? Math.round(totalSteps / sessionStats.length) : 0
      
      return {
        totalSessions: sessionStats?.length || (user as any).total_requests || 0,
        completedSessions,
        averageSteps,
        lastActiveAt: (user as any).last_active_at || new Date().toISOString()
      }

    } catch (error) {
      logger.error('Failed to get user stats', { lineUserId, error })
      return null
    }
  }

  /**
   * セッション状態の検証
   */
  static validateSessionState(state: ConversationState): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // ステップの妥当性チェック
    if (![1, 2, 3].includes(state.currentStep)) {
      errors.push('Invalid current step')
    }

    // ステップ2以降でカテゴリが必須
    if (state.currentStep >= 2 && !state.category) {
      errors.push('Category is required for step 2+')
    }

    // ステップ3で詳細情報が必須
    if (state.currentStep === 3) {
      const hasDetails = state.requirements.details && 
                        typeof state.requirements.details === 'string' &&
                        state.requirements.details.length >= 10

      if (!hasDetails) {
        errors.push('Details are required for step 3')
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}