import { supabaseAdmin } from './client'
import { logger } from '../utils/logger'
import { InputValidator } from '../utils/input-validator'

// SessionQueriesを再エクスポート
export { SessionQueries } from './session-queries'

export class UserQueries {
  static async createOrUpdate(lineUserId: string, displayName?: string) {
    try {
      // LINE User IDの検証（SQLインジェクション対策）
      if (!InputValidator.validateLineUserId(lineUserId)) {
        throw new Error('Invalid LINE User ID format')
      }
      
      // まず既存ユーザーを検索（line_user_idで検索）
      const { data: existingUser, error: findError } = await (supabaseAdmin as any)
        .from('users')
        .select('*')
        .eq('line_user_id', lineUserId)
        .limit(1)
        .maybeSingle()

      if (findError && findError.code !== 'PGRST116') {
        logger.error('Error finding user', { error: findError })
        throw findError
      }

      if (existingUser) {
        // 既存ユーザーを更新
        const updateData: any = {
          last_active_at: new Date().toISOString(),
          total_requests: ((existingUser as any).total_requests || 0) + 1
        }

        // LINE表示名が提供され、かつ未設定または変更されている場合は更新
        if (displayName && displayName !== (existingUser as any).line_display_name) {
          updateData.line_display_name = displayName
        }

        const { data, error } = await (supabaseAdmin as any)
          .from('users')
          .update(updateData)
          .eq('id', (existingUser as any).id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // 新規ユーザーを作成
        const { data, error } = await (supabaseAdmin as any)
          .from('users')
          .insert({
            line_user_id: lineUserId,  // line_user_idにLINE IDを正しく保存
            display_name: displayName || null,  // display_nameにはLINEの表示名を保存
            line_display_name: displayName || null,  // LINE表示名も保存
            skill_level: 'beginner',
            subscription_status: 'free',
            monthly_usage_count: 0,
            total_requests: 1,
            last_active_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    } catch (error) {
      logger.error('UserQueries.createOrUpdate error', { error })
      // エラーでも最小限のユーザーオブジェクトを返す
      return {
        id: lineUserId,
        line_user_id: lineUserId,  // line_user_idにLINE IDを保存
        display_name: null,
        skill_level: 'beginner',
        subscription_status: 'free',
        monthly_usage_count: 0
      }
    }
  }
  
  static async resetMonthlyUsage(userId: string) {
    const { error } = await (supabaseAdmin as any)
      .from('users')
      .update({
        monthly_usage_count: 0,
        last_reset_date: new Date().toISOString()
      })
      .eq('display_name', userId)  // display_nameにLINE IDが格納されている
    
    if (error) {
      logger.error('Failed to reset monthly usage', { error })
    }
  }
  
  static async incrementUsageCount(userId: string) {
    const { data: user, error: fetchError } = await (supabaseAdmin as any)
      .from('users')
      .select('monthly_usage_count')
      .eq('display_name', userId)  // display_nameにLINE IDが格納されている
      .limit(1)
      .maybeSingle()
    
    if (fetchError || !user) {
      logger.error('Failed to fetch usage count', { error: fetchError })
      return
    }
    
    const { error } = await (supabaseAdmin as any)
      .from('users')
      .update({
        monthly_usage_count: ((user as any).monthly_usage_count || 0) + 1
      })
      .eq('display_name', userId)  // display_nameにLINE IDが格納されている
    
    if (error) {
      logger.error('Failed to increment usage count', { error })
    }
  }
}

export class QueueQueries {
  static async addToQueue(jobData: any) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .insert(jobData)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      logger.error('QueueQueries.addToQueue error:', { error })
      // 仮のレスポンス（DBエラー時でも動作継続）
      return {
        id: `temp_${Date.now()}`,
        ...jobData,
        created_at: new Date().toISOString()
      }
    }
  }
  
  static async getNextJobs(batchSize: number) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(batchSize)
      
      if (error) {
        logger.error('Error getting next jobs:', { error })
        return []
      }
      
      return data || []
    } catch (error) {
      logger.error('QueueQueries.getNextJobs error:', { error })
      return []
    }
  }
  
  static async getPendingJobsCount() {
    try {
      const { count, error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      if (error) {
        logger.error('Error getting pending jobs count:', { error })
        return 0
      }
      
      return count || 0
    } catch (error) {
      logger.error('QueueQueries.getPendingJobsCount error:', { error })
      return 0
    }
  }
  
  static async markJobProcessing(jobId: string) {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .update({
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      if (error) {
        logger.error('Error marking job as processing:', { error })
      }
    } catch (error) {
      logger.error('QueueQueries.markJobProcessing error:', { error })
    }
  }
  
  static async markJobCompleted(jobId: string) {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      if (error) {
        logger.error('Error marking job as completed:', { error })
      }
    } catch (error) {
      logger.error('QueueQueries.markJobCompleted error:', { error })
    }
  }
  
  static async markJobFailed(jobId: string, errorMessage: string) {
    try {
      // リトライカウントを増やす
      const { data: job, error: fetchError } = await (supabaseAdmin as any)
        .from('generation_queue')
        .select('retry_count, max_retries')
        .eq('id', jobId)
        .single()
      
      if (fetchError || !job) {
        logger.error('Error fetching job for retry:', { fetchError })
        return
      }
      
      const newRetryCount = ((job as any).retry_count || 0) + 1
      const status = newRetryCount >= ((job as any).max_retries || 3) ? 'failed' : 'pending'
      
      const { error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .update({
          status,
          retry_count: newRetryCount,
          error_message: errorMessage,
          processed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      if (error) {
        logger.error('Error marking job as failed:', { error })
      }
    } catch (error) {
      logger.error('QueueQueries.markJobFailed error:', { error })
    }
  }
  
  static async updateJobStatus(jobId: string, updates: any) {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .update(updates)
        .eq('id', jobId)
      
      if (error) {
        logger.error('Error updating job status:', { error })
      }
    } catch (error) {
      logger.error('QueueQueries.updateJobStatus error:', { error })
    }
  }
}

export class UsageQueries {
  static async getDailyUsage(userId?: string) {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // userIdがない場合は全体の使用量を取得
      let query = (supabaseAdmin as any)
        .from('claude_usage')
        .select('total_tokens, total_cost')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
      
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query
      
      if (error) {
        logger.error('Error getting daily usage:', { error })
        return { tokens: 0, cost: 0, requests: 0 }
      }
      
      const totalTokens = data?.reduce((sum: number, row: any) => sum + ((row as any).total_tokens || 0), 0) || 0
      const totalCost = data?.reduce((sum: number, row: any) => sum + ((row as any).total_cost || 0), 0) || 0
      const totalRequests = data?.length || 0
      
      return { tokens: totalTokens, cost: totalCost, requests: totalRequests }
    } catch (error) {
      logger.error('UsageQueries.getDailyUsage error:', { error })
      return { tokens: 0, cost: 0, requests: 0 }
    }
  }
  
  static async logClaudeUsage(data: {
    userId: string
    sessionId?: string
    model: string
    promptTokens: number
    completionTokens: number
    totalTokens: number
    cost: number
  }) {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('claude_usage')
        .insert({
          user_id: data.userId,
          session_id: data.sessionId,
          model: data.model,
          prompt_tokens: data.promptTokens,
          completion_tokens: data.completionTokens,
          total_tokens: data.totalTokens,
          total_cost: data.cost,
          created_at: new Date().toISOString()
        })
      
      if (error) {
        logger.error('Error logging Claude usage:', { error })
      }
    } catch (error) {
      logger.error('UsageQueries.logClaudeUsage error:', { error })
    }
  }
  
  static async getMonthlyUsage(userId: string) {
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const { data, error } = await (supabaseAdmin as any)
        .from('claude_usage')
        .select('total_tokens, total_cost')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
      
      if (error) {
        logger.error('Error getting monthly usage:', { error })
        return { tokens: 0, cost: 0 }
      }
      
      const totalTokens = data?.reduce((sum: number, row: any) => sum + ((row as any).total_tokens || 0), 0) || 0
      const totalCost = data?.reduce((sum: number, row: any) => sum + ((row as any).total_cost || 0), 0) || 0
      
      return { tokens: totalTokens, cost: totalCost }
    } catch (error) {
      logger.error('UsageQueries.getMonthlyUsage error:', { error })
      return { tokens: 0, cost: 0 }
    }
  }
}

export class MetricsQueries {
  static async recordMetric(metric: any) {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('metrics')
        .insert({
          metric_type: metric.metric_type,
          metric_value: metric.metric_value,
          metadata: metric.metadata,
          created_at: new Date().toISOString()
        })
      
      if (error) {
        logger.error('Error recording metric:', { error })
      }
    } catch (error) {
      logger.error('MetricsQueries.recordMetric error:', { error })
    }
  }
}

// SessionQueriesクラスは session-queries.ts に移動済み
// 重複を避けるためここでは定義しない


export class CodeQueries {
  static async getRecentCodes(userId: string, limit: number = 3) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('generated_codes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('CodeQueries.getRecentCodes error:', { error })
      return []
    }
  }

  static async isFirstTimeUser(userId: string): Promise<boolean> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('generated_codes')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        logger.error('Error checking first time user:', { error })
        return false
      }

      // データがなければ初回ユーザー
      return !data
    } catch (error) {
      logger.error('CodeQueries.isFirstTimeUser error:', { error })
      return false
    }
  }

  static async saveGeneratedCode(codeData: any) {
    try {
      // UUID型エラーを完全回避 - idカラムを明示的に除外
      
      const insertData = {
        user_id: String(codeData.user_id || codeData.line_user_id),
        session_id: String(codeData.session_id || `session_${Date.now()}`),
        queue_id: String(codeData.queue_id || ''),
        code: String(codeData.code || ''),
        gas_url: String(codeData.gas_url || ''),
        category: String(codeData.category || ''),
        subcategory: String(codeData.subcategory || ''),
        requirements: codeData.requirements || {},
        quality_score: Number(codeData.quality_score || 0),
        created_at: new Date().toISOString()
      }
      
      const { data, error } = await (supabaseAdmin as any)
        .from('generated_codes')
        .insert(insertData)
        .select()
        .single()
      
      if (error) {
        logger.error('Failed to save generated code', { 
          error: error.message,
          errorCode: error.code,
          errorHint: error.hint
        })
        throw error
      }
      return data
    } catch (error: any) {
      logger.error('CodeQueries.saveGeneratedCode error:', {
        message: error?.message,
        code: error?.code,
        hint: error?.hint
      })
      return null
    }
  }
}

export class ClaudeUsageQueries {
  static async logUsage(usageData: any) {
    try {
      await (supabaseAdmin as any)
        .from('claude_usage_logs')
        .insert(usageData)
    } catch (error) {
      logger.error('ClaudeUsageQueries.logUsage error:', { error })
    }
  }

  static async getUsageSummary(userId: string) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('claude_usage_logs')
        .select('estimated_cost')
        .eq('user_id', userId)
      
      if (error) throw error
      
      const total = (data || []).reduce((sum: number, row: any) => 
        sum + (row.estimated_cost || 0), 0
      )
      
      return { total_cost: total, usage_count: (data || []).length }
    } catch (error) {
      logger.error('ClaudeUsageQueries.getUsageSummary error:', { error })
      return { total_cost: 0, usage_count: 0 }
    }
  }
}

export class ProcessingQueueQueries {
  static async addToQueue(jobData: any) {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('processing_queue')
        .insert({
          ...jobData,
          status: 'pending',
          priority: 1,
          attempts: 0
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      logger.error('ProcessingQueueQueries.addToQueue error:', { error })
      return null
    }
  }

  static async getNextJob() {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('processing_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        await (supabaseAdmin as any)
          .from('processing_queue')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', (data as any).id)
      }
      
      return data
    } catch (error) {
      logger.error('ProcessingQueueQueries.getNextJob error:', { error })
      return null
    }
  }

  static async updateJobStatus(jobId: string, status: string, result?: any, errorMessage?: string) {
    try {
      const updates: any = { 
        status,
        completed_at: new Date().toISOString()
      }
      
      if (result) updates.result = result
      if (errorMessage) updates.error_message = errorMessage
      
      const { data, error } = await (supabaseAdmin as any)
        .from('processing_queue')
        .update(updates)
        .eq('id', jobId)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      logger.error('ProcessingQueueQueries.updateJobStatus error:', { error })
      return null
    }
  }
}

// エクスポート
export default {
  UserQueries,
  MetricsQueries,
  CodeQueries,
  ClaudeUsageQueries,
  QueueQueries,
  ProcessingQueueQueries,
  UsageQueries
}
