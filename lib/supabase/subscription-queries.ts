/**
 * サブスクリプション・システムカタログ関連のクエリ
 *
 * 2026-01-27: 新料金プラン対応
 */

import { supabaseAdmin } from './client'
import { logger } from '../utils/logger'
import {
  SubscriptionPlan,
  UserSubscription,
  UserSubscriptionWithPlan,
  InsertUserSubscription,
  UpdateUserSubscription,
  System,
  InsertSystem,
  UpdateSystem,
  SystemDocument,
  InsertSystemDocument,
  UserDownload,
  InsertUserDownload,
  CanDownloadResult,
  ExecuteDownloadResult,
  SystemListItem,
  UserSubscriptionSummary,
  UserSystemAccess,
  InsertUserSystemAccess
} from './subscription-types'

// ===================================================================
// サブスクリプションプラン
// ===================================================================

export class SubscriptionPlanQueries {
  /**
   * 全てのアクティブなプランを取得
   */
  static async getActivePlans(): Promise<SubscriptionPlan[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('SubscriptionPlanQueries.getActivePlans error', { error })
      return []
    }
  }

  /**
   * プランをIDで取得
   */
  static async getPlanById(planId: string): Promise<SubscriptionPlan | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('subscription_plans')
        .select('*')
        .eq('id', planId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      logger.error('SubscriptionPlanQueries.getPlanById error', { error })
      return null
    }
  }

  /**
   * プランを名前で取得
   */
  static async getPlanByName(name: string): Promise<SubscriptionPlan | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('subscription_plans')
        .select('*')
        .eq('name', name)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      logger.error('SubscriptionPlanQueries.getPlanByName error', { error })
      return null
    }
  }
}

// ===================================================================
// ユーザーサブスクリプション
// ===================================================================

export class UserSubscriptionQueries {
  /**
   * ユーザーのアクティブなサブスクリプションを取得
   */
  static async getActiveSubscription(userId: string): Promise<UserSubscriptionWithPlan | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('user_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      logger.error('UserSubscriptionQueries.getActiveSubscription error', { error })
      return null
    }
  }

  /**
   * ユーザーのサブスクリプション履歴を取得
   */
  static async getSubscriptionHistory(userId: string): Promise<UserSubscriptionWithPlan[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('user_subscriptions')
        .select(`
          *,
          plan:subscription_plans(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('UserSubscriptionQueries.getSubscriptionHistory error', { error })
      return []
    }
  }

  /**
   * サブスクリプション作成
   */
  static async createSubscription(data: InsertUserSubscription): Promise<UserSubscription | null> {
    try {
      const { data: subscription, error } = await (supabaseAdmin as any)
        .from('user_subscriptions')
        .insert(data)
        .select()
        .single()

      if (error) throw error

      logger.info('Subscription created', {
        userId: data.user_id,
        planId: data.plan_id
      })

      return subscription
    } catch (error) {
      logger.error('UserSubscriptionQueries.createSubscription error', { error })
      return null
    }
  }

  /**
   * サブスクリプション更新
   */
  static async updateSubscription(
    subscriptionId: string,
    updates: UpdateUserSubscription
  ): Promise<UserSubscription | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('user_subscriptions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('UserSubscriptionQueries.updateSubscription error', { error })
      return null
    }
  }

  /**
   * サブスクリプションキャンセル
   */
  static async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('user_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', subscriptionId)

      if (error) throw error

      logger.info('Subscription cancelled', { subscriptionId })
      return true
    } catch (error) {
      logger.error('UserSubscriptionQueries.cancelSubscription error', { error })
      return false
    }
  }

  /**
   * ユーザーのサブスクリプションサマリーを取得
   */
  static async getSubscriptionSummary(userId: string): Promise<UserSubscriptionSummary> {
    try {
      const subscription = await this.getActiveSubscription(userId)

      if (!subscription) {
        return {
          has_active_subscription: false,
          plan_name: null,
          plan_display_name: null,
          expires_at: null,
          downloads_remaining: 0,
          downloads_limit: 0,
          viewable_systems_count: null
        }
      }

      return {
        has_active_subscription: true,
        plan_name: subscription.plan.name,
        plan_display_name: subscription.plan.display_name,
        expires_at: subscription.expires_at,
        downloads_remaining: subscription.plan.monthly_downloads - subscription.downloads_this_month,
        downloads_limit: subscription.plan.monthly_downloads,
        viewable_systems_count: subscription.plan.viewable_systems
      }
    } catch (error) {
      logger.error('UserSubscriptionQueries.getSubscriptionSummary error', { error })
      return {
        has_active_subscription: false,
        plan_name: null,
        plan_display_name: null,
        expires_at: null,
        downloads_remaining: 0,
        downloads_limit: 0,
        viewable_systems_count: null
      }
    }
  }
}

// ===================================================================
// システムカタログ
// ===================================================================

export class SystemQueries {
  /**
   * 公開システム一覧を取得
   */
  static async getPublishedSystems(): Promise<SystemListItem[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('systems')
        .select(`
          id, name, slug, description, category,
          thumbnail_url, difficulty_level, download_count, is_featured
        `)
        .eq('is_published', true)
        .order('is_featured', { ascending: false })
        .order('download_count', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('SystemQueries.getPublishedSystems error', { error })
      return []
    }
  }

  /**
   * システムをスラッグで取得
   */
  static async getSystemBySlug(slug: string): Promise<System | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('systems')
        .select('*')
        .eq('slug', slug)
        .eq('is_published', true)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      logger.error('SystemQueries.getSystemBySlug error', { error })
      return null
    }
  }

  /**
   * システムをIDで取得
   */
  static async getSystemById(systemId: string): Promise<System | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('systems')
        .select('*')
        .eq('id', systemId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      logger.error('SystemQueries.getSystemById error', { error })
      return null
    }
  }

  /**
   * システム作成
   */
  static async createSystem(data: InsertSystem): Promise<System | null> {
    try {
      const { data: system, error } = await (supabaseAdmin as any)
        .from('systems')
        .insert(data)
        .select()
        .single()

      if (error) throw error

      logger.info('System created', { systemId: system.id, slug: data.slug })
      return system
    } catch (error) {
      logger.error('SystemQueries.createSystem error', { error })
      return null
    }
  }

  /**
   * システム更新
   */
  static async updateSystem(systemId: string, updates: UpdateSystem): Promise<System | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('systems')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', systemId)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      logger.error('SystemQueries.updateSystem error', { error })
      return null
    }
  }

  /**
   * 閲覧数をインクリメント
   */
  static async incrementViewCount(systemId: string): Promise<void> {
    try {
      await (supabaseAdmin as any)
        .from('systems')
        .update({
          view_count: (supabaseAdmin as any).rpc('increment', { x: 1 }),
          updated_at: new Date().toISOString()
        })
        .eq('id', systemId)
    } catch (error) {
      logger.error('SystemQueries.incrementViewCount error', { error })
    }
  }

  /**
   * カテゴリでシステムを検索
   */
  static async getSystemsByCategory(category: string): Promise<SystemListItem[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('systems')
        .select(`
          id, name, slug, description, category,
          thumbnail_url, difficulty_level, download_count, is_featured
        `)
        .eq('is_published', true)
        .eq('category', category)
        .order('download_count', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('SystemQueries.getSystemsByCategory error', { error })
      return []
    }
  }
}

// ===================================================================
// システムドキュメント
// ===================================================================

export class SystemDocumentQueries {
  /**
   * システムのドキュメントを取得
   */
  static async getDocumentsBySystemId(systemId: string): Promise<SystemDocument[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('system_documents')
        .select('*')
        .eq('system_id', systemId)
        .order('doc_type')

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('SystemDocumentQueries.getDocumentsBySystemId error', { error })
      return []
    }
  }

  /**
   * ドキュメント作成
   */
  static async createDocument(data: InsertSystemDocument): Promise<SystemDocument | null> {
    try {
      const { data: doc, error } = await (supabaseAdmin as any)
        .from('system_documents')
        .insert(data)
        .select()
        .single()

      if (error) throw error
      return doc
    } catch (error) {
      logger.error('SystemDocumentQueries.createDocument error', { error })
      return null
    }
  }

  /**
   * 全ドキュメントをRAG用に取得（チャンク化前）
   */
  static async getAllDocumentsForRag(): Promise<SystemDocument[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('system_documents')
        .select(`
          *,
          system:systems(name, slug, category)
        `)
        .order('system_id')

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('SystemDocumentQueries.getAllDocumentsForRag error', { error })
      return []
    }
  }
}

// ===================================================================
// ダウンロード管理
// ===================================================================

export class DownloadQueries {
  /**
   * ダウンロード可否チェック（RPC関数呼び出し）
   */
  static async canDownload(userId: string, systemId: string): Promise<CanDownloadResult> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .rpc('can_download_system', {
          p_user_id: userId,
          p_system_id: systemId
        })

      if (error) throw error
      return data
    } catch (error) {
      logger.error('DownloadQueries.canDownload error', { error })
      return {
        can_download: false,
        reason: 'no_subscription',
        message: 'エラーが発生しました'
      }
    }
  }

  /**
   * ダウンロード実行（RPC関数呼び出し）
   */
  static async executeDownload(
    userId: string,
    systemId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<ExecuteDownloadResult> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .rpc('execute_system_download', {
          p_user_id: userId,
          p_system_id: systemId,
          p_ip_address: ipAddress || null,
          p_user_agent: userAgent || null
        })

      if (error) throw error

      logger.info('System downloaded', { userId, systemId })
      return data
    } catch (error) {
      logger.error('DownloadQueries.executeDownload error', { error })
      return {
        success: false,
        message: 'ダウンロードに失敗しました'
      }
    }
  }

  /**
   * ユーザーのダウンロード履歴を取得
   */
  static async getUserDownloads(userId: string): Promise<UserDownload[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('user_downloads')
        .select(`
          *,
          system:systems(name, slug, category)
        `)
        .eq('user_id', userId)
        .eq('is_revoked', false)
        .order('downloaded_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('DownloadQueries.getUserDownloads error', { error })
      return []
    }
  }

  /**
   * ダウンロード済みかチェック
   */
  static async hasDownloaded(userId: string, systemId: string): Promise<boolean> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('user_downloads')
        .select('id')
        .eq('user_id', userId)
        .eq('system_id', systemId)
        .eq('is_revoked', false)
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') throw error
      return !!data
    } catch (error) {
      logger.error('DownloadQueries.hasDownloaded error', { error })
      return false
    }
  }
}

// ===================================================================
// システムアクセス権
// ===================================================================

export class SystemAccessQueries {
  /**
   * ユーザーがアクセス可能なシステム一覧を取得
   */
  static async getAccessibleSystems(userId: string): Promise<string[]> {
    try {
      // 1. 明示的にアクセス権が付与されているシステム
      const { data: explicitAccess, error: accessError } = await (supabaseAdmin as any)
        .from('user_system_access')
        .select('system_id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

      if (accessError) throw accessError

      // 2. ダウンロード済みのシステム
      const { data: downloaded, error: downloadError } = await (supabaseAdmin as any)
        .from('user_downloads')
        .select('system_id')
        .eq('user_id', userId)
        .eq('is_revoked', false)

      if (downloadError) throw downloadError

      // 重複を除去して結合
      const systemIds = new Set<string>([
        ...(explicitAccess || []).map((a: any) => a.system_id),
        ...(downloaded || []).map((d: any) => d.system_id)
      ])

      return Array.from(systemIds)
    } catch (error) {
      logger.error('SystemAccessQueries.getAccessibleSystems error', { error })
      return []
    }
  }

  /**
   * アクセス権を付与
   */
  static async grantAccess(data: InsertUserSystemAccess): Promise<UserSystemAccess | null> {
    try {
      const { data: access, error } = await (supabaseAdmin as any)
        .from('user_system_access')
        .upsert(data, { onConflict: 'user_id,system_id,access_type' })
        .select()
        .single()

      if (error) throw error

      logger.info('System access granted', {
        userId: data.user_id,
        systemId: data.system_id,
        accessType: data.access_type
      })

      return access
    } catch (error) {
      logger.error('SystemAccessQueries.grantAccess error', { error })
      return null
    }
  }

  /**
   * アクセス権を取り消し
   */
  static async revokeAccess(userId: string, systemId: string): Promise<boolean> {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('user_system_access')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('system_id', systemId)

      if (error) throw error

      logger.info('System access revoked', { userId, systemId })
      return true
    } catch (error) {
      logger.error('SystemAccessQueries.revokeAccess error', { error })
      return false
    }
  }
}

// ===================================================================
// エクスポート
// ===================================================================

export default {
  SubscriptionPlanQueries,
  UserSubscriptionQueries,
  SystemQueries,
  SystemDocumentQueries,
  DownloadQueries,
  SystemAccessQueries
}
