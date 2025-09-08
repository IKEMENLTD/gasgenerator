import { UsageQueries } from '@/lib/supabase/queries'
import { logger } from '@/lib/utils/logger'
import { CLAUDE_CONFIG } from '@/lib/constants/config'

interface UsageLimits {
  dailyRequests: number
  dailyCost: number
  hourlyRequests: number
  monthlyRequests: number
}

const DEFAULT_LIMITS: UsageLimits = {
  dailyRequests: 100,
  dailyCost: 30, // USD
  hourlyRequests: 20,
  monthlyRequests: 2000
}

export class ClaudeUsageTracker {
  /**
   * 使用量制限チェック（リクエスト前）
   */
  static async checkUsageLimits(userId?: string): Promise<{
    allowed: boolean
    reason?: string
    retryAfter?: number
  }> {
    try {
      // プレミアムユーザーのチェック
      if (userId) {
        const { supabaseAdmin } = await import('@/lib/supabase/client')
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('subscription_status, subscription_end_date')
          .eq('display_name', userId)
          .maybeSingle()
        
        if (!error && user && user.subscription_status === 'premium') {
          // 有効期限チェック
          if (user.subscription_end_date) {
            const endDate = new Date(user.subscription_end_date)
            if (endDate > new Date()) {
              // プレミアムユーザーは制限なし
              return { allowed: true }
            }
          }
        }
      }

      // 日次制限チェック
      const dailyCheck = await this.checkDailyLimits(userId)
      if (!dailyCheck.allowed) {
        return dailyCheck
      }

      // 時間制限チェック
      const hourlyCheck = await this.checkHourlyLimits(userId)
      if (!hourlyCheck.allowed) {
        return hourlyCheck
      }

      // 全体の制限チェック（サービス全体）
      const globalCheck = await this.checkGlobalLimits()
      if (!globalCheck.allowed) {
        return globalCheck
      }

      return { allowed: true }

    } catch (error) {
      logger.error('Usage limit check failed', { userId, error })
      // エラー時は制限なしとする（可用性を優先）
      return { allowed: true }
    }
  }

  /**
   * 日次制限チェック
   */
  private static async checkDailyLimits(userId?: string): Promise<{
    allowed: boolean
    reason?: string
    retryAfter?: number
  }> {
    const { requests, cost } = await UsageQueries.getDailyUsage(userId)

    // リクエスト数制限
    if (requests >= DEFAULT_LIMITS.dailyRequests) {
      const retryAfter = this.getSecondsUntilMidnight()
      logger.warn('Daily request limit exceeded', { userId, requests, limit: DEFAULT_LIMITS.dailyRequests })
      
      return {
        allowed: false,
        reason: `Daily request limit (${DEFAULT_LIMITS.dailyRequests}) exceeded`,
        retryAfter
      }
    }

    // コスト制限
    if (cost >= DEFAULT_LIMITS.dailyCost) {
      const retryAfter = this.getSecondsUntilMidnight()
      logger.warn('Daily cost limit exceeded', { userId, cost, limit: DEFAULT_LIMITS.dailyCost })
      
      return {
        allowed: false,
        reason: `Daily cost limit ($${DEFAULT_LIMITS.dailyCost}) exceeded`,
        retryAfter
      }
    }

    return { allowed: true }
  }

  /**
   * 時間制限チェック
   */
  private static async checkHourlyLimits(userId?: string): Promise<{
    allowed: boolean
    reason?: string
    retryAfter?: number
  }> {
    // 過去1時間のリクエスト数を取得
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    // TODO: 時間単位での使用量取得クエリ実装
    // 現在は日次データで代用
    const { requests } = await UsageQueries.getDailyUsage(userId)
    const estimatedHourlyRequests = Math.ceil(requests / 24)

    if (estimatedHourlyRequests >= DEFAULT_LIMITS.hourlyRequests) {
      const retryAfter = 3600 // 1時間後
      logger.warn('Hourly request limit exceeded', { 
        userId, 
        estimatedRequests: estimatedHourlyRequests, 
        limit: DEFAULT_LIMITS.hourlyRequests 
      })
      
      return {
        allowed: false,
        reason: `Hourly request limit (${DEFAULT_LIMITS.hourlyRequests}) exceeded`,
        retryAfter
      }
    }

    return { allowed: true }
  }

  /**
   * グローバル制限チェック（全ユーザー合計）
   */
  private static async checkGlobalLimits(): Promise<{
    allowed: boolean
    reason?: string
    retryAfter?: number
  }> {
    const { requests, cost } = await UsageQueries.getDailyUsage() // 全ユーザー

    // 全体の日次リクエスト制限（例：1000件/日）
    const globalDailyLimit = 1000
    if (requests >= globalDailyLimit) {
      const retryAfter = this.getSecondsUntilMidnight()
      logger.warn('Global daily request limit exceeded', { requests, limit: globalDailyLimit })
      
      return {
        allowed: false,
        reason: 'Service daily limit exceeded',
        retryAfter
      }
    }

    // 全体のコスト制限（例：$500/日）
    const globalCostLimit = 500
    if (cost >= globalCostLimit) {
      const retryAfter = this.getSecondsUntilMidnight()
      logger.warn('Global daily cost limit exceeded', { cost, limit: globalCostLimit })
      
      return {
        allowed: false,
        reason: 'Service daily cost limit exceeded',
        retryAfter
      }
    }

    return { allowed: true }
  }

  /**
   * 使用量統計の取得
   */
  static async getUsageStats(userId?: string): Promise<{
    daily: { requests: number; cost: number; percentage: number }
    hourly: { requests: number; percentage: number }
    monthly: { requests: number; cost: number }
  }> {
    try {
      const { requests: dailyRequests, cost: dailyCost } = await UsageQueries.getDailyUsage(userId)
      
      // TODO: 月次データの取得
      const monthlyRequests = dailyRequests * 30 // 概算
      const monthlyCost = dailyCost * 30 // 概算

      return {
        daily: {
          requests: dailyRequests,
          cost: dailyCost,
          percentage: Math.round((dailyRequests / DEFAULT_LIMITS.dailyRequests) * 100)
        },
        hourly: {
          requests: Math.ceil(dailyRequests / 24), // 概算
          percentage: Math.round((Math.ceil(dailyRequests / 24) / DEFAULT_LIMITS.hourlyRequests) * 100)
        },
        monthly: {
          requests: monthlyRequests,
          cost: monthlyCost
        }
      }

    } catch (error) {
      logger.error('Failed to get usage stats', { userId, error })
      return {
        daily: { requests: 0, cost: 0, percentage: 0 },
        hourly: { requests: 0, percentage: 0 },
        monthly: { requests: 0, cost: 0 }
      }
    }
  }

  /**
   * コスト見積もり
   */
  static estimateCost(inputTokens: number, outputTokens: number): number {
    return (inputTokens * CLAUDE_CONFIG.COST_PER_INPUT_TOKEN) + 
           (outputTokens * CLAUDE_CONFIG.COST_PER_OUTPUT_TOKEN)
  }

  /**
   * 使用量アラート（管理者通知）
   */
  static async checkAndSendAlerts(): Promise<void> {
    try {
      const stats = await this.getUsageStats()
      
      // 80%を超えたらアラート
      if (stats.daily.percentage >= 80) {
        logger.warn('High usage alert', {
          dailyPercentage: stats.daily.percentage,
          dailyRequests: stats.daily.requests,
          dailyCost: stats.daily.cost
        })
        
        // TODO: 管理者への通知（メール、Slack等）
      }

      // 日次コストが$25を超えたらアラート
      if (stats.daily.cost >= 25) {
        logger.warn('High cost alert', {
          dailyCost: stats.daily.cost,
          dailyRequests: stats.daily.requests
        })
      }

    } catch (error) {
      logger.error('Failed to check usage alerts', { error })
    }
  }

  /**
   * 午前0時までの秒数を取得
   */
  private static getSecondsUntilMidnight(): number {
    const now = new Date()
    const midnight = new Date(now)
    midnight.setHours(24, 0, 0, 0)
    
    return Math.ceil((midnight.getTime() - now.getTime()) / 1000)
  }

  /**
   * 使用量リセット（日次バッチ処理用）
   */
  static async resetDailyUsage(): Promise<void> {
    try {
      // 古い使用量ログの削除は SQL トリガーで実行されるため、
      // ここでは統計情報のログのみ
      const stats = await this.getUsageStats()
      
      logger.info('Daily usage reset', {
        previousDayRequests: stats.daily.requests,
        previousDayCost: stats.daily.cost
      })

    } catch (error) {
      logger.error('Failed to reset daily usage', { error })
    }
  }

  /**
   * 使用量予測
   */
  static async predictUsage(userId?: string): Promise<{
    estimatedDailyRequests: number
    estimatedDailyCost: number
    willExceedLimit: boolean
    recommendation: string
  }> {
    try {
      const { requests, cost } = await UsageQueries.getDailyUsage(userId)
      const currentHour = new Date().getHours()
      
      // 現在の時間から1日の使用量を予測
      const hourlyAverage = requests / Math.max(1, currentHour)
      const estimatedDailyRequests = Math.ceil(hourlyAverage * 24)
      const estimatedDailyCost = (cost / Math.max(1, currentHour)) * 24

      const willExceedLimit = estimatedDailyRequests > DEFAULT_LIMITS.dailyRequests ||
                             estimatedDailyCost > DEFAULT_LIMITS.dailyCost

      let recommendation = 'Normal usage pattern'
      if (willExceedLimit) {
        recommendation = 'Usage limit may be exceeded. Consider reducing requests.'
      } else if (estimatedDailyRequests > DEFAULT_LIMITS.dailyRequests * 0.8) {
        recommendation = 'Approaching usage limit. Monitor requests closely.'
      }

      return {
        estimatedDailyRequests,
        estimatedDailyCost,
        willExceedLimit,
        recommendation
      }

    } catch (error) {
      logger.error('Failed to predict usage', { userId, error })
      return {
        estimatedDailyRequests: 0,
        estimatedDailyCost: 0,
        willExceedLimit: false,
        recommendation: 'Unable to predict usage'
      }
    }
  }
}