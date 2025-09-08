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
    logger.info('=== RATE LIMIT CHECK START ===', {
      userId,
      imageHash: imageHash.substring(0, 8),
      isPremium,
      timestamp: new Date().toISOString()
    })
    
    // Supabaseが設定されていない場合のチェック
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      logger.error('CRITICAL: Supabase not configured for rate limiting', {
        hasUrl: !!process.env.SUPABASE_URL,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      })
      
      // データベースがない場合はメモリ内カウンターで制限
      // グローバル変数で簡易的に管理
      if (!global.visionUsageCounter) {
        global.visionUsageCounter = new Map()
      }
      
      const todayKey = `${userId}_${new Date().toISOString().split('T')[0]}`
      const currentCount = global.visionUsageCounter.get(todayKey) || 0
      const dailyLimit = isPremium ? this.LIMITS.PREMIUM.daily : this.LIMITS.FREE.daily
      
      logger.warn('Using in-memory rate limiting', {
        userId,
        todayKey,
        currentCount,
        dailyLimit
      })
      
      if (currentCount >= dailyLimit) {
        return {
          allowed: false,
          reason: `本日の画像解析上限（${dailyLimit}回）に達しました。\n明日また利用できます。${!isPremium ? '\n\n💎 プレミアムプランなら1日100回まで解析可能！' : ''}`,
          remainingToday: 0
        }
      }
      
      // カウントを事前に増やす
      global.visionUsageCounter.set(todayKey, currentCount + 1)
      
      return {
        allowed: true,
        remainingToday: dailyLimit - currentCount - 1,
        remainingMonth: 999 // メモリ内では月次制限は管理しない
      }
    }
    
    try {
      // 1. 同じ画像の重複チェック（エラースクショは除外）
      // エラースクリーンショットは何度でも送信できるようにする
      const { data: duplicates } = await supabaseAdmin
        .from('vision_usage')
        .select('id, analysis_result, status')
        .eq('image_hash', imageHash)
        .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5分以内に短縮（エラー解決用）
        .eq('status', 'completed')
        .limit(1)
      
      if (duplicates && duplicates.length > 0) {
        const duplicate = duplicates[0]
        logger.info('Duplicate image detected - allowing retry', { userId, imageHash })
        // 重複でもカウントは消費するが、再解析は許可（エラー解決のため）
        // コメントアウトして重複チェックを無効化
        /*
        return {
          allowed: false,
          reason: '同じ画像は5分以内に既に解析済みです。\n\n前回の結果:\n' + duplicate.analysis_result
        }
        */
      }
      
      // 1.5. 定期的にクリーンアップ（10%の確率で実行）
      if (Math.random() < 0.1) {
        this.cleanupStaleProcessingRecords().catch(err => 
          logger.error('Background cleanup failed', { err })
        )
      }
      
      // 2. 本日の使用回数チェック（新しいprocessingとcompletedのみ）
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      // completedの数 + 5分以内のprocessingの数
      const { data: usageRecords, error: todayError } = await supabaseAdmin
        .from('vision_usage')
        .select('status, created_at')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
      
      if (todayError) {
        logger.error('Failed to fetch today usage', { 
          error: todayError,
          userId,
          query: { from: today.toISOString() }
        })
        // エラー時は安全側に倒す
        return {
          allowed: false,
          reason: '利用状況の確認に失敗しました。しばらく後でお試しください。'
        }
      }
      
      const todayCount = usageRecords?.filter(record => 
        record.status === 'completed' || 
        (record.status === 'processing' && record.created_at >= fiveMinutesAgo)
      ).length || 0
      
      logger.info('Today usage count', {
        userId,
        todayCount,
        totalRecords: usageRecords?.length || 0,
        completedRecords: usageRecords?.filter(r => r.status === 'completed').length || 0,
        processingRecords: usageRecords?.filter(r => r.status === 'processing').length || 0,
        isPremium,
        dailyLimit: isPremium ? this.LIMITS.PREMIUM.daily : this.LIMITS.FREE.daily
      })
      
      const dailyLimit = isPremium ? this.LIMITS.PREMIUM.daily : this.LIMITS.FREE.daily
      if ((todayCount || 0) >= dailyLimit) {
        logger.warn('Daily limit exceeded', { 
          userId, 
          todayCount, 
          dailyLimit,
          isPremium 
        })
        return {
          allowed: false,
          reason: `本日の画像解析上限（${dailyLimit}回）に達しました。\n明日また利用できます。${!isPremium ? '\n\n💎 プレミアムプランなら1日100回まで解析可能！' : ''}`,
          remainingToday: 0
        }
      }
      
      // 3. 月間使用回数チェック（ユーザー）
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      
      const { data: monthRecords, error: monthError } = await supabaseAdmin
        .from('vision_usage')
        .select('status, created_at')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
      
      if (monthError) {
        logger.error('Failed to fetch monthly usage', { 
          error: monthError,
          userId,
          query: { from: startOfMonth.toISOString() }
        })
        return {
          allowed: false,
          reason: '利用状況の確認に失敗しました。しばらく後でお試しください。'
        }
      }
      
      const monthCount = monthRecords?.filter(record => 
        record.status === 'completed' || 
        (record.status === 'processing' && record.created_at >= fiveMinutesAgo)
      ).length || 0
      
      logger.info('Monthly usage count', {
        userId,
        monthCount,
        totalMonthRecords: monthRecords?.length || 0,
        isPremium,
        monthlyLimit: isPremium ? this.LIMITS.PREMIUM.monthly : this.LIMITS.FREE.monthly
      })
      
      const monthlyLimit = isPremium ? this.LIMITS.PREMIUM.monthly : this.LIMITS.FREE.monthly
      if ((monthCount || 0) >= monthlyLimit) {
        logger.warn('Monthly limit exceeded', { 
          userId, 
          monthCount, 
          monthlyLimit,
          isPremium 
        })
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
      
      const { data: globalRecords } = await supabaseAdmin
        .from('vision_usage')
        .select('status, created_at')
        .gte('created_at', startOfMonth.toISOString())
      
      const globalCount = globalRecords?.filter(record => 
        record.status === 'completed' || 
        (record.status === 'processing' && record.created_at >= fiveMinutesAgo)
      ).length || 0
      
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
      
      const result = {
        allowed: true,
        remainingToday: dailyLimit - (todayCount || 0),
        remainingMonth: monthlyLimit - (monthCount || 0)
      }
      
      logger.info('=== RATE LIMIT CHECK RESULT ===', {
        userId,
        ...result,
        isPremium,
        limits: {
          daily: dailyLimit,
          monthly: monthlyLimit
        },
        usage: {
          today: todayCount,
          month: monthCount
        }
      })
      
      return result
      
    } catch (error) {
      logger.error('Vision rate limit check failed', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId,
        imageHash
      })
      // エラー時は安全側に倒す（使用不可）
      return {
        allowed: false,
        reason: '画像解析の利用状況確認に失敗しました。しばらく後でお試しください。'
      }
    }
  }
  
  /**
   * 画像解析の使用を事前に記録（レースコンディション対策）
   */
  async recordUsagePlaceholder(
    userId: string,
    imageHash: string
  ): Promise<string> {
    const maxRetries = 3
    let lastError: any
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        // レースコンディション対策: 同じユーザーが同時にprocessingを作ろうとしていないか確認
        const { data: existing } = await supabaseAdmin
          .from('vision_usage')
          .select('id')
          .eq('user_id', userId)
          .eq('image_hash', imageHash)
          .eq('status', 'processing')
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // 5分以内
          .limit(1)
        
        if (existing && existing.length > 0) {
          logger.warn('Duplicate processing detected', { userId, imageHash, existingId: existing[0].id })
          return existing[0].id // 既存のプレースホルダーを再利用
        }
        
        const { data, error } = await supabaseAdmin
          .from('vision_usage')
          .insert({
            user_id: userId,
            image_hash: imageHash,
            analysis_result: '[PROCESSING]',
            status: 'processing',
            created_at: new Date().toISOString()
          })
          .select('id')
          .single()
        
        if (error) throw error
        return data.id
        
      } catch (error: any) {
        lastError = error
        logger.error(`Placeholder creation attempt ${i + 1} failed`, { 
          error: error.message,
          userId,
          imageHash 
        })
        
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))) // バックオフ
        }
      }
    }
    
    throw lastError
  }
  
  /**
   * プレースホルダーを実際の結果で更新
   */
  async updateUsageWithResult(
    placeholderId: string,
    analysisResult: string,
    metadata?: {
      imageSize?: number
      processingTime?: number
    }
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('vision_usage')
        .update({
          analysis_result: analysisResult.substring(0, 1000),
          image_size_bytes: metadata?.imageSize,
          processing_time_ms: metadata?.processingTime,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', placeholderId)
        .eq('status', 'processing') // processing状態のもののみ更新
      
      if (error) {
        logger.error('Failed to update usage with result', { 
          error,
          placeholderId,
          willRollback: true 
        })
        // 更新失敗時はプレースホルダーを削除
        await this.rollbackUsage(placeholderId)
      }
    } catch (error) {
      logger.error('Critical error in updateUsageWithResult', { 
        error,
        placeholderId 
      })
      // クリティカルエラー時もロールバック
      await this.rollbackUsage(placeholderId)
    }
  }
  
  /**
   * エラー時にプレースホルダーを削除
   */
  async rollbackUsage(placeholderId: string): Promise<void> {
    if (!placeholderId) {
      logger.warn('Rollback called with empty placeholderId')
      return
    }
    
    try {
      const { error } = await supabaseAdmin
        .from('vision_usage')
        .delete()
        .eq('id', placeholderId)
        .eq('status', 'processing') // processing状態のもののみ削除（安全対策）
      
      if (error) {
        logger.error('Failed to rollback usage', { 
          error,
          placeholderId,
          errorCode: error.code,
          errorHint: error.hint 
        })
      } else {
        logger.info('Successfully rolled back placeholder', { placeholderId })
      }
    } catch (error) {
      logger.error('Critical error during rollback', { 
        error,
        placeholderId 
      })
    }
  }
  
  /**
   * 古いprocessing状態のレコードをクリーンアップ
   */
  async cleanupStaleProcessingRecords(): Promise<number> {
    try {
      // 5分以上前のprocessing状態のレコードを削除
      const staleTime = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data, error } = await supabaseAdmin
        .from('vision_usage')
        .delete()
        .eq('status', 'processing')
        .lt('created_at', staleTime)
        .select('id')
      
      if (error) {
        logger.error('Failed to cleanup stale records', { error })
        return 0
      }
      
      const count = data?.length || 0
      if (count > 0) {
        logger.info('Cleaned up stale processing records', { count })
      }
      
      return count
    } catch (error) {
      logger.error('Critical error in cleanup', { error })
      return 0
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