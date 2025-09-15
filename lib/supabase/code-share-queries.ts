/**
 * コード共有機能のSupabaseクエリ関数
 */

import { createClient } from './client'
import { logger } from '@/lib/utils/logger'
import { customAlphabet } from 'nanoid'
import * as bcrypt from 'bcryptjs'
import {
  CodeShare,
  CreateCodeShareParams,
  CodeShareSearchCriteria,
  CodeShareAccessLog,
  AccessType,
  HistoryAction,
  RelationType
} from '@/types/code-share'

// 短縮ID生成用のアルファベット（紛らわしい文字を除外）
const ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz'
const generateShortId = customAlphabet(ALPHABET, 8)

/**
 * コード共有のクエリクラス
 */
export class CodeShareQueries {
  /**
   * ユニークな短縮IDを生成
   */
  private static async generateUniqueShortId(maxRetries: number = 5): Promise<string> {
    const supabase = createClient()

    for (let i = 0; i < maxRetries; i++) {
      const shortId = generateShortId()

      // 重複チェック
      const { data, error } = await supabase
        .from('code_shares')
        .select('short_id')
        .eq('short_id', shortId)
        .single()

      if (error?.code === 'PGRST116') {
        // レコードが見つからない = 使用可能
        return shortId
      }

      if (!error && !data) {
        return shortId
      }

      logger.debug('Short ID collision detected, regenerating', {
        attempt: i + 1,
        shortId
      })
    }

    throw new Error('Failed to generate unique short ID')
  }

  /**
   * コード共有を作成
   */
  static async create(params: CreateCodeShareParams): Promise<CodeShare> {
    const supabase = createClient()

    try {
      // 短縮IDを生成
      const shortId = await this.generateUniqueShortId()

      // 有効期限を計算
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + params.expiresInDays)

      // パスワードのハッシュ化
      let passwordHash: string | undefined
      if (params.password) {
        passwordHash = await bcrypt.hash(params.password, 10)
      }

      // データ挿入
      const { data, error } = await supabase
        .from('code_shares')
        .insert({
          short_id: shortId,
          user_id: params.userId,
          job_id: params.jobId,
          session_id: params.sessionId,
          parent_id: params.parentId,
          title: params.title,
          description: params.description,
          code_content: params.code,
          language: 'javascript',
          file_name: 'code.gs',
          is_public: true,
          password_hash: passwordHash,
          max_views: params.maxViews,
          tags: params.tags || [],
          conversation_context: params.conversationContext,
          requirements: params.requirements,
          is_premium: params.isPremium,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single()

      if (error) {
        logger.error('Failed to create code share', { error })
        throw error
      }

      // 履歴に記録
      await this.recordHistory(params.userId, data.id, 'generated')

      // 会話との関連を保存
      if (params.sessionId) {
        await this.createRelation(
          params.userId,
          params.sessionId,
          data.id,
          params.parentId ? 'modified' : 'original'
        )
      }

      logger.info('Code share created', {
        shortId,
        userId: params.userId,
        title: params.title
      })

      // Dateフィールドを変換
      return {
        ...data,
        expires_at: new Date(data.expires_at),
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
        last_viewed_at: data.last_viewed_at ? new Date(data.last_viewed_at) : undefined
      } as CodeShare

    } catch (error) {
      logger.error('Error creating code share', { error, params })
      throw error
    }
  }

  /**
   * 短縮IDでコード共有を取得
   */
  static async getByShortId(shortId: string): Promise<CodeShare | null> {
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('code_shares')
        .select('*')
        .eq('short_id', shortId)
        .eq('is_deleted', false)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Not found
        }
        throw error
      }

      if (!data) return null

      // Dateフィールドを変換
      return {
        ...data,
        expires_at: new Date(data.expires_at),
        created_at: new Date(data.created_at),
        updated_at: new Date(data.updated_at),
        last_viewed_at: data.last_viewed_at ? new Date(data.last_viewed_at) : undefined
      } as CodeShare

    } catch (error) {
      logger.error('Error fetching code share', { error, shortId })
      throw error
    }
  }

  /**
   * コード共有を更新
   */
  static async update(
    shortId: string,
    userId: string,
    updates: Partial<CodeShare>
  ): Promise<CodeShare> {
    const supabase = createClient()

    try {
      const { data, error } = await supabase
        .from('code_shares')
        .update(updates)
        .eq('short_id', shortId)
        .eq('user_id', userId)
        .eq('is_deleted', false)
        .select()
        .single()

      if (error) {
        logger.error('Failed to update code share', { error })
        throw error
      }

      return data

    } catch (error) {
      logger.error('Error updating code share', { error, shortId })
      throw error
    }
  }

  /**
   * コード共有を削除（論理削除）
   */
  static async delete(
    shortId: string,
    userId: string,
    reason?: string
  ): Promise<void> {
    const supabase = createClient()

    try {
      const { error } = await supabase
        .from('code_shares')
        .update({
          is_deleted: true,
          deletion_reason: reason || 'user_requested'
        })
        .eq('short_id', shortId)
        .eq('user_id', userId)

      if (error) {
        throw error
      }

      // 履歴に記録
      const codeShare = await this.getByShortId(shortId)
      if (codeShare) {
        await this.recordHistory(userId, codeShare.id, 'deleted', { reason })
      }

      logger.info('Code share deleted', { shortId, userId, reason })

    } catch (error) {
      logger.error('Error deleting code share', { error, shortId })
      throw error
    }
  }

  /**
   * 閲覧回数をインクリメント
   */
  static async incrementViewCount(
    shortId: string,
    accessLog?: Partial<CodeShareAccessLog>
  ): Promise<void> {
    const supabase = createClient()

    try {
      // トランザクション的な処理
      // 1. コード共有を取得
      const codeShare = await this.getByShortId(shortId)
      if (!codeShare) {
        throw new Error('Code share not found')
      }

      // 2. 最大閲覧回数チェック
      if (codeShare.max_views && codeShare.view_count >= codeShare.max_views) {
        throw new Error('Maximum views reached')
      }

      // 3. カウントを更新
      const { error: updateError } = await supabase
        .from('code_shares')
        .update({
          view_count: codeShare.view_count + 1,
          last_viewed_at: new Date().toISOString()
        })
        .eq('short_id', shortId)

      if (updateError) {
        throw updateError
      }

      // 4. アクセスログを記録
      if (accessLog) {
        await this.recordAccessLog(codeShare.id, 'view', accessLog)
      }

    } catch (error) {
      logger.error('Error incrementing view count', { error, shortId })
      throw error
    }
  }

  /**
   * コピー回数をインクリメント
   */
  static async incrementCopyCount(shortId: string): Promise<void> {
    const supabase = createClient()

    try {
      const codeShare = await this.getByShortId(shortId)
      if (!codeShare) {
        throw new Error('Code share not found')
      }

      const { error } = await supabase
        .from('code_shares')
        .update({
          copy_count: codeShare.copy_count + 1
        })
        .eq('short_id', shortId)

      if (error) {
        throw error
      }

      // アクセスログを記録
      await this.recordAccessLog(codeShare.id, 'copy')

    } catch (error) {
      logger.error('Error incrementing copy count', { error, shortId })
      throw error
    }
  }

  /**
   * ユーザーのコード共有一覧を取得
   */
  static async getUserShares(
    userId: string,
    criteria?: CodeShareSearchCriteria
  ): Promise<CodeShare[]> {
    const supabase = createClient()

    try {
      let query = supabase
        .from('code_shares')
        .select('*')
        .eq('user_id', userId)
        .eq('is_deleted', false)

      // 検索条件を適用
      if (criteria) {
        if (criteria.tags && criteria.tags.length > 0) {
          query = query.contains('tags', criteria.tags)
        }
        if (criteria.isPublic !== undefined) {
          query = query.eq('is_public', criteria.isPublic)
        }
        if (criteria.isPremium !== undefined) {
          query = query.eq('is_premium', criteria.isPremium)
        }
        if (criteria.createdAfter) {
          query = query.gte('created_at', criteria.createdAfter.toISOString())
        }
        if (criteria.createdBefore) {
          query = query.lte('created_at', criteria.createdBefore.toISOString())
        }

        // ソート
        const orderBy = criteria.orderBy || 'created_at'
        const orderDirection = criteria.orderDirection || 'desc'
        query = query.order(orderBy, { ascending: orderDirection === 'asc' })

        // ページネーション
        if (criteria.limit) {
          query = query.limit(criteria.limit)
        }
        if (criteria.offset) {
          query = query.range(criteria.offset, criteria.offset + (criteria.limit || 10) - 1)
        }
      } else {
        // デフォルトソート
        query = query.order('created_at', { ascending: false }).limit(20)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      // Dateフィールドを変換
      return (data || []).map((item: any) => ({
        ...item,
        expires_at: new Date(item.expires_at),
        created_at: new Date(item.created_at),
        updated_at: new Date(item.updated_at),
        last_viewed_at: item.last_viewed_at ? new Date(item.last_viewed_at) : undefined
      })) as CodeShare[]

    } catch (error) {
      logger.error('Error fetching user shares', { error, userId })
      throw error
    }
  }

  /**
   * 関連コードを取得
   */
  static async getRelatedShares(shareId: string): Promise<CodeShare[]> {
    const supabase = createClient()

    try {
      // 親コードまたは子コードを取得
      const { data: currentShare } = await supabase
        .from('code_shares')
        .select('parent_id, id')
        .eq('id', shareId)
        .single()

      if (!currentShare) {
        return []
      }

      // 親がある場合は親とその他の子を取得
      // 親がない場合は子を取得
      const parentId = currentShare.parent_id || shareId

      const { data, error } = await supabase
        .from('code_shares')
        .select('*')
        .or(`id.eq.${parentId},parent_id.eq.${parentId}`)
        .eq('is_deleted', false)
        .order('version', { ascending: true })

      if (error) {
        throw error
      }

      return data || []

    } catch (error) {
      logger.error('Error fetching related shares', { error, shareId })
      throw error
    }
  }

  /**
   * アクセスログを記録
   */
  private static async recordAccessLog(
    shareId: string,
    accessType: AccessType,
    details?: Partial<CodeShareAccessLog>
  ): Promise<void> {
    const supabase = createClient()

    try {
      await supabase
        .from('code_share_access_logs')
        .insert({
          share_id: shareId,
          access_type: accessType,
          ...details
        })

    } catch (error) {
      // ログ記録の失敗は無視（メイン処理に影響させない）
      logger.warn('Failed to record access log', { error, shareId })
    }
  }

  /**
   * ユーザー履歴を記録
   */
  private static async recordHistory(
    userId: string,
    shareId: string,
    action: HistoryAction,
    details?: Record<string, any>
  ): Promise<void> {
    const supabase = createClient()

    try {
      await supabase
        .from('user_code_history')
        .insert({
          user_id: userId,
          share_id: shareId,
          action: action,
          action_details: details
        })

    } catch (error) {
      logger.warn('Failed to record history', { error, userId, shareId })
    }
  }

  /**
   * 会話との関連を作成
   */
  private static async createRelation(
    userId: string,
    sessionId: string,
    shareId: string,
    relationType: RelationType
  ): Promise<void> {
    const supabase = createClient()

    try {
      await supabase
        .from('conversation_code_relations')
        .insert({
          user_id: userId,
          session_id: sessionId,
          share_id: shareId,
          relation_type: relationType
        })

    } catch (error) {
      logger.warn('Failed to create relation', { error, userId, sessionId, shareId })
    }
  }

  /**
   * 期限切れコードをクリーンアップ
   */
  static async cleanupExpired(): Promise<number> {
    const supabase = createClient()

    try {
      // 論理削除
      const { data: expiredShares, error: selectError } = await supabase
        .from('code_shares')
        .select('id')
        .lt('expires_at', new Date().toISOString())
        .eq('is_deleted', false)

      if (selectError) {
        throw selectError
      }

      if (!expiredShares || expiredShares.length === 0) {
        return 0
      }

      const { error: updateError } = await supabase
        .from('code_shares')
        .update({
          is_deleted: true,
          deletion_reason: 'expired'
        })
        .in('id', expiredShares.map(s => s.id))

      if (updateError) {
        throw updateError
      }

      logger.info('Cleaned up expired code shares', { count: expiredShares.length })
      return expiredShares.length

    } catch (error) {
      logger.error('Error cleaning up expired shares', { error })
      throw error
    }
  }

  /**
   * 統計情報を取得
   */
  static async getStats(shareId: string): Promise<{
    totalViews: number
    totalCopies: number
    uniqueVisitors: number
    deviceStats: Record<string, number>
  }> {
    const supabase = createClient()

    try {
      // コード共有の基本情報
      const { data: share } = await supabase
        .from('code_shares')
        .select('view_count, copy_count')
        .eq('id', shareId)
        .single()

      // アクセスログの統計
      const { data: logs } = await supabase
        .from('code_share_access_logs')
        .select('ip_address, device_type')
        .eq('share_id', shareId)

      // デバイス別統計
      const deviceStats: Record<string, number> = {}
      const uniqueIps = new Set<string>()

      logs?.forEach((log: any) => {
        if (log.ip_address) {
          uniqueIps.add(log.ip_address)
        }
        if (log.device_type) {
          deviceStats[log.device_type] = (deviceStats[log.device_type] || 0) + 1
        }
      })

      return {
        totalViews: share?.view_count || 0,
        totalCopies: share?.copy_count || 0,
        uniqueVisitors: uniqueIps.size,
        deviceStats
      }

    } catch (error) {
      logger.error('Error fetching stats', { error, shareId })
      throw error
    }
  }
}