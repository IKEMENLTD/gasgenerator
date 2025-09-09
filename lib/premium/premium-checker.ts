import { supabaseAdmin } from '../supabase/client'
import { logger } from '../utils/logger'

export interface PremiumStatus {
  isPremium: boolean
  remainingUses: number
  canGenerate: boolean
  message?: string
}

export class PremiumChecker {
  // 無料プランの制限
  private static readonly FREE_MONTHLY_LIMIT = 10
  private static readonly PREMIUM_MONTHLY_LIMIT = 9999 // 実質無制限

  /**
   * ユーザーのプレミアムステータスをチェック
   */
  static async checkPremiumStatus(userId: string): Promise<PremiumStatus> {
    try {
      // ユーザー情報を取得（display_nameをLINE IDとして使用）
      let { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select('display_name, subscription_status, subscription_end_date, monthly_usage_count, last_reset_date')
        .eq('display_name', userId)
        .maybeSingle()
      
      // ユーザーが存在しない場合、新規作成
      if (!user) {
        const { data: newUser, error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            display_name: userId,  // display_nameにLINE IDを保存
            subscription_status: 'free',
            monthly_usage_count: 0,
            total_requests: 0,
            created_at: new Date().toISOString()
          })
          .select()
          .single()
        
        if (insertError) {
          logger.error('Failed to create user', { insertError, userId })
        }
        
        user = newUser
      }

      if (userError || !user) {
        logger.warn('User not found, treating as free user', { userId })
        return {
          isPremium: false,
          remainingUses: this.FREE_MONTHLY_LIMIT,
          canGenerate: true,
          message: `無料プラン: 月${this.FREE_MONTHLY_LIMIT}回まで`
        }
      }

      // 月次リセットチェック
      const now = new Date()
      const lastReset = user.last_reset_date ? new Date(user.last_reset_date) : null
      const needsReset = !lastReset || 
        lastReset.getMonth() !== now.getMonth() || 
        lastReset.getFullYear() !== now.getFullYear()

      if (needsReset) {
        // 月が変わったので使用回数をリセット
        await supabaseAdmin
          .from('users')
          .update({
            monthly_usage_count: 0,
            last_reset_date: now.toISOString().split('T')[0]
          })
          .eq('display_name', userId)

        user.monthly_usage_count = 0
        logger.info('Monthly usage reset for user', { userId })
      }

      // プレミアムステータスチェック
      const isPremium = user.subscription_status === 'premium' && 
                       user.subscription_end_date && 
                       new Date(user.subscription_end_date) > now

      const usageCount = user.monthly_usage_count || 0
      const limit = isPremium ? this.PREMIUM_MONTHLY_LIMIT : this.FREE_MONTHLY_LIMIT
      const remaining = Math.max(0, limit - usageCount)

      // 無料ユーザーで制限に達した場合
      if (!isPremium && usageCount >= this.FREE_MONTHLY_LIMIT) {
        return {
          isPremium: false,
          remainingUses: 0,
          canGenerate: false,
          message: '📊 無料プランの月間利用回数（10回）に達しました。\\n\\nプレミアムプランで無制限利用が可能です！'
        }
      }

      return {
        isPremium,
        remainingUses: remaining,
        canGenerate: true,
        message: isPremium 
          ? 'プレミアムプラン: 無制限' 
          : `無料プラン: 残り${remaining}回`
      }

    } catch (error) {
      logger.error('Failed to check premium status', { error, userId })
      // エラー時は安全側に倒して生成を拒否
      return {
        isPremium: false,
        remainingUses: 0,
        canGenerate: false,
        message: 'ステータス確認エラーが発生しました。しばらくしてからお試しください。'
      }
    }
  }

  /**
   * 使用回数をインクリメント
   */
  static async incrementUsage(userId: string): Promise<boolean> {
    try {
      // 直接更新（RPCは使用しない）
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('monthly_usage_count, total_requests')
        .eq('display_name', userId)
        .single()

      const currentCount = user?.monthly_usage_count || 0
      const totalRequests = user?.total_requests || 0

      const { error } = await supabaseAdmin
        .from('users')
        .update({ 
          monthly_usage_count: currentCount + 1,
          total_requests: totalRequests + 1,
          last_active_at: new Date().toISOString()
        })
        .eq('display_name', userId)
      
      if (error) {
        logger.error('Failed to update usage count', { error, userId })
        return false
      }

      logger.info('Usage incremented', { userId })
      return true

    } catch (error) {
      logger.error('Failed to increment usage', { error, userId })
      return false
    }
  }

  /**
   * プレミアムプランへのアップグレードリンクを生成
   */
  static getUpgradeUrl(userId: string): string {
    const encodedUserId = Buffer.from(userId).toString('base64')
    return `https://buy.stripe.com/8wMdTAc9m8zQgmI9AA?client_reference_id=${encodedUserId}`
  }
}