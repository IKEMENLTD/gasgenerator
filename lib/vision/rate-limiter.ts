import { supabaseAdmin } from '../supabase/client'
import { logger } from '../utils/logger'

// Node.jsのcryptoモジュールを安全にインポート
let crypto: any
if (typeof window === 'undefined') {
  crypto = require('crypto')
} else {
  // ブラウザ環境では Web Crypto API を使用
  crypto = {
    createHash: (algorithm: string) => {
      throw new Error('Image hashing is not supported in browser environment')
    }
  }
}

export class VisionRateLimiter {
  // 料金制限設定（月1万円プランベース）
  private readonly LIMITS = {
    FREE: {
      daily: 3,         // 無料：1日3回（お試し）
      monthly: 20,      // 月20回まで
    },
    PREMIUM: {
      daily: 100,       // プレミアム：1日100回（実質無制限）
      monthly: 1500,    // 月1,500回まで（原価2,850円）
    },
    GLOBAL: {
      monthly: 0,       // 動的計算（プレミアムユーザー数×1500）
      alert: 0,         // 動的計算（80%で警告）
    }
  }
  
  /**
   * 画像解析の使用可否チェック
   */
  async canUseVision(
    userId: string, 
    imageHash: string,
    isPremium: boolean
  ): Promise<{
    allowed: boolean
    reason?: string
    remainingToday?: number
    remainingMonth?: number
  }> {
    try {
      // 1. 同じ画像の重複チェック（24時間以内）
      const { data: duplicate } = await supabaseAdminAdmin
        .from('vision_usage')
        .select('id, analysis_result')
        .eq('image_hash', imageHash)
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single()
      
      if (duplicate) {
        logger.info('Duplicate image detected', { userId, imageHash })
        return {
          allowed: false,
          reason: '同じ画像は24時間以内に既に解析済みです。\n\n前回の結果:\n' + duplicate.analysis_result
        }
      }
      
      // 2. 本日の使用回数チェック
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { count: todayCount } = await supabaseAdmin
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
      
      const dailyLimit = isPremium ? this.LIMITS.PREMIUM.daily : this.LIMITS.FREE.daily
      if ((todayCount || 0) >= dailyLimit) {
        return {
          allowed: false,
          reason: `本日の画像解析上限（${dailyLimit}回）に達しました。\n明日また利用できます。${!isPremium ? '\n\n💎 プレミアムプランなら1日10回まで解析可能！' : ''}`,
          remainingToday: 0
        }
      }
      
      // 3. 月間使用回数チェック（ユーザー）
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      
      const { count: monthCount } = await supabaseAdmin
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
      
      const monthlyLimit = isPremium ? this.LIMITS.PREMIUM.monthly : this.LIMITS.FREE.monthly
      if ((monthCount || 0) >= monthlyLimit) {
        return {
          allowed: false,
          reason: `今月の画像解析上限（${monthlyLimit}回）に達しました。\n来月また利用できます。${!isPremium ? '\n\n💎 プレミアムプランなら月100回まで解析可能！' : ''}`,
          remainingMonth: 0
        }
      }
      
      // 4. 全体の月間使用量チェック（動的計算）
      // プレミアムユーザー数を取得
      const { count: premiumUserCount } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'premium')
        .gte('subscription_end_date', new Date().toISOString())
      
      // 動的上限を計算（最低でも1500回は確保）
      const dynamicMonthlyLimit = Math.max(1500, (premiumUserCount || 0) * 1500)
      const dynamicAlertLimit = Math.floor(dynamicMonthlyLimit * 0.8) // 80%で警告
      
      const { count: globalCount } = await supabaseAdmin
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString())
      
      if ((globalCount || 0) >= dynamicMonthlyLimit) {
        logger.error('GLOBAL VISION LIMIT REACHED', { 
          globalCount, 
          limit: dynamicMonthlyLimit,
          premiumUsers: premiumUserCount 
        })
        return {
          allowed: false,
          reason: 'システムの月間画像解析上限に達しました。\n大変申し訳ございませんが、しばらくお待ちください。'
        }
      }
      
      // 5. 警告レベルチェック
      if ((globalCount || 0) >= dynamicAlertLimit) {
        logger.warn('Vision usage alert threshold reached', { 
          globalCount, 
          threshold: dynamicAlertLimit,
          limit: dynamicMonthlyLimit 
        })
        // TODO: 管理者に通知
      }
      
      return {
        allowed: true,
        remainingToday: dailyLimit - (todayCount || 0),
        remainingMonth: monthlyLimit - (monthCount || 0)
      }
      
    } catch (error) {
      logger.error('Vision rate limit check failed', { error })
      // エラー時は安全側に倒す（使用不可）
      return {
        allowed: false,
        reason: '画像解析の利用状況確認に失敗しました。しばらく後でお試しください。'
      }
    }
  }
  
  /**
   * 画像解析の使用を記録
   */
  async recordUsage(
    userId: string,
    imageHash: string,
    analysisResult: string,
    metadata?: {
      imageSize?: number
      processingTime?: number
    }
  ): Promise<void> {
    try {
      await supabaseAdmin.from('vision_usage').insert({
        user_id: userId,
        image_hash: imageHash,
        analysis_result: analysisResult.substring(0, 1000), // 最初の1000文字だけ保存
        image_size_bytes: metadata?.imageSize,
        processing_time_ms: metadata?.processingTime,
        created_at: new Date().toISOString()
      })
    } catch (error) {
      logger.error('Failed to record vision usage', { error })
    }
  }
  
  /**
   * 画像のハッシュ値を計算
   */
  calculateImageHash(imageBuffer: Buffer): string {
    return crypto.createHash('sha256').update(imageBuffer).digest('hex')
  }
  
  /**
   * 使用統計の取得
   */
  async getUsageStats(): Promise<{
    todayTotal: number
    monthTotal: number
    estimatedCost: number
    alertLevel: 'normal' | 'warning' | 'critical'
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    
    const [todayResult, monthResult] = await Promise.all([
      supabase
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today.toISOString()),
      supabase
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString())
    ])
    
    const monthTotal = monthResult.count || 0
    const estimatedCost = monthTotal * 0.01275 // $0.01275 per image
    
    let alertLevel: 'normal' | 'warning' | 'critical' = 'normal'
    if (monthTotal >= this.LIMITS.GLOBAL.monthly) {
      alertLevel = 'critical'
    } else if (monthTotal >= this.LIMITS.GLOBAL.alert) {
      alertLevel = 'warning'
    }
    
    return {
      todayTotal: todayResult.count || 0,
      monthTotal,
      estimatedCost,
      alertLevel
    }
  }
}

export const visionRateLimiter = new VisionRateLimiter()