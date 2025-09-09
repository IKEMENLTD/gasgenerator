import { supabaseAdmin } from '../supabase/client'
import { logger } from '../utils/logger'
import * as crypto from 'crypto'

/**
 * データベースベースのレート制限実装
 * サーバーレス環境でも動作する
 */
export class DatabaseRateLimiter {
  // 料金制限設定
  private readonly LIMITS = {
    FREE: {
      daily: 3,         // 無料：1日3回
      monthly: 20,      // 月20回まで
    },
    PREMIUM: {
      daily: 100,       // プレミアム：1日100回
      monthly: 1500,    // 月1,500回まで
    }
  }
  
  /**
   * レート制限チェック（アトミック操作）
   */
  async checkAndIncrement(
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
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      // 1. 重複チェック（同じ画像は再解析しない）
      const { data: existing } = await supabaseAdmin
        .from('vision_usage')
        .select('analysis_result')
        .eq('user_id', userId)
        .eq('image_hash', imageHash)
        .eq('status', 'completed')
        .single()
      
      if (existing) {
        logger.info('Image already analyzed, using cached result', { 
          userId, 
          imageHash: imageHash.substring(0, 8) 
        })
        return {
          allowed: true,
          reason: 'cached',
          remainingToday: 999,
          remainingMonth: 999
        }
      }
      
      // 2. 現在の使用量を取得（トランザクション的に）
      const { data: todayUsage } = await supabaseAdmin
        .from('vision_usage')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
      
      const { data: monthUsage } = await supabaseAdmin
        .from('vision_usage')
        .select('id', { count: 'exact' })
        .eq('user_id', userId)
        .gte('created_at', `${thisMonth}-01T00:00:00`)
      
      const todayCount = todayUsage?.length || 0
      const monthCount = monthUsage?.length || 0
      
      // 3. 制限チェック
      const limits = isPremium ? this.LIMITS.PREMIUM : this.LIMITS.FREE
      const dailyRemaining = Math.max(0, limits.daily - todayCount)
      const monthlyRemaining = Math.max(0, limits.monthly - monthCount)
      
      if (dailyRemaining <= 0) {
        return {
          allowed: false,
          reason: '本日の利用上限に達しました',
          remainingToday: 0,
          remainingMonth: monthlyRemaining
        }
      }
      
      if (monthlyRemaining <= 0) {
        return {
          allowed: false,
          reason: '今月の利用上限に達しました',
          remainingToday: dailyRemaining,
          remainingMonth: 0
        }
      }
      
      // 4. 使用記録を作成（アトミック操作）
      const { error: insertError } = await supabaseAdmin
        .from('vision_usage')
        .insert({
          user_id: userId,
          image_hash: imageHash,
          analysis_result: '',
          status: 'processing',
          created_at: now.toISOString()
        })
      
      if (insertError) {
        // 挿入エラー（同時実行の可能性）
        if (insertError.code === '23505') { // unique constraint violation
          logger.warn('Concurrent rate limit check detected', { userId })
          return {
            allowed: false,
            reason: '処理中です。しばらくお待ちください',
            remainingToday: dailyRemaining,
            remainingMonth: monthlyRemaining
          }
        }
        throw insertError
      }
      
      logger.info('Rate limit check passed', {
        userId,
        isPremium,
        todayCount: todayCount + 1,
        monthCount: monthCount + 1,
        dailyRemaining: dailyRemaining - 1,
        monthlyRemaining: monthlyRemaining - 1
      })
      
      return {
        allowed: true,
        remainingToday: dailyRemaining - 1,
        remainingMonth: monthlyRemaining - 1
      }
      
    } catch (error) {
      logger.error('Rate limit check error', { error, userId })
      
      // エラー時は安全側に倒す（拒否）
      return {
        allowed: false,
        reason: 'システムエラーが発生しました',
        remainingToday: 0,
        remainingMonth: 0
      }
    }
  }
  
  /**
   * 解析結果を更新
   */
  async updateAnalysisResult(
    userId: string,
    imageHash: string,
    result: string,
    processingTimeMs: number,
    imageSizeBytes?: number
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('vision_usage')
        .update({
          analysis_result: result,
          status: 'completed',
          processing_time_ms: processingTimeMs,
          image_size_bytes: imageSizeBytes,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('image_hash', imageHash)
        .eq('status', 'processing')
      
      if (error) {
        logger.error('Failed to update analysis result', { error, userId, imageHash })
      }
    } catch (error) {
      logger.error('Update analysis result error', { error, userId })
    }
  }
  
  /**
   * 解析失敗を記録
   */
  async markAnalysisFailed(
    userId: string,
    imageHash: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('vision_usage')
        .update({
          status: 'failed',
          analysis_result: errorMessage,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('image_hash', imageHash)
        .eq('status', 'processing')
      
      if (error) {
        logger.error('Failed to mark analysis as failed', { error, userId, imageHash })
      }
    } catch (error) {
      logger.error('Mark analysis failed error', { error, userId })
    }
  }
  
  /**
   * 使用統計を取得
   */
  async getUsageStats(userId: string): Promise<{
    todayUsage: number
    monthUsage: number
    totalUsage: number
  }> {
    try {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      // 今日の使用量
      const { count: todayCount } = await supabaseAdmin
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('created_at', `${today}T00:00:00`)
      
      // 今月の使用量
      const { count: monthCount } = await supabaseAdmin
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
        .gte('created_at', `${thisMonth}-01T00:00:00`)
      
      // 全期間の使用量
      const { count: totalCount } = await supabaseAdmin
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed')
      
      return {
        todayUsage: todayCount || 0,
        monthUsage: monthCount || 0,
        totalUsage: totalCount || 0
      }
    } catch (error) {
      logger.error('Failed to get usage stats', { error, userId })
      return {
        todayUsage: 0,
        monthUsage: 0,
        totalUsage: 0
      }
    }
  }
  
  /**
   * グローバル使用量チェック（コスト管理）
   */
  async checkGlobalLimit(): Promise<{
    withinLimit: boolean
    currentUsage: number
    monthlyLimit: number
    alertThreshold: number
  }> {
    try {
      const now = new Date()
      const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      
      // 今月の全ユーザー使用量
      const { count: totalUsage } = await supabaseAdmin
        .from('vision_usage')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', `${thisMonth}-01T00:00:00`)
      
      // プレミアムユーザー数を取得
      const { count: premiumUsers } = await supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_status', 'premium')
        .gte('subscription_end_date', now.toISOString())
      
      const currentUsage = totalUsage || 0
      const monthlyLimit = Math.max(3000, (premiumUsers || 0) * 1500) // 最低3000回
      const alertThreshold = Math.floor(monthlyLimit * 0.8)
      
      // 警告レベルチェック
      if (currentUsage >= alertThreshold) {
        logger.warn('Global Vision API usage approaching limit', {
          currentUsage,
          monthlyLimit,
          percentage: Math.round((currentUsage / monthlyLimit) * 100)
        })
      }
      
      return {
        withinLimit: currentUsage < monthlyLimit,
        currentUsage,
        monthlyLimit,
        alertThreshold
      }
    } catch (error) {
      logger.error('Failed to check global limit', { error })
      // エラー時は制限なしとして扱う
      return {
        withinLimit: true,
        currentUsage: 0,
        monthlyLimit: 99999,
        alertThreshold: 99999
      }
    }
  }
}

// シングルトンインスタンス
export const databaseRateLimiter = new DatabaseRateLimiter()