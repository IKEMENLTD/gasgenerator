import { supabaseAdmin } from './client'
import { logger } from '../utils/logger'

// SessionQueriesを再エクスポート
export { SessionQueries } from './session-queries'

export class UserQueries {
  static async createOrUpdate(lineUserId: string) {
    try {
      // まず既存ユーザーを検索（line_user_idカラムの存在チェックを含む）
      const { data: existingUser, error: findError } = await supabaseAdmin
        .from<any>('users')
        .select('*')
        .or(`line_user_id.eq.${lineUserId}`)
        .maybeSingle()

      if (findError && findError.code !== 'PGRST116') {
        console.error('Error finding user:', findError)
        throw findError
      }

      if (existingUser) {
        // 既存ユーザーを更新
        const { data, error } = await supabaseAdmin
          .from<any>('users')
          .update({
            last_active_at: new Date().toISOString(),
            total_requests: (existingUser.total_requests || 0) + 1
          })
          .eq('id', existingUser.id)
          .select()
          .single()

        if (error) throw error
        return data
      } else {
        // 新規ユーザーを作成
        const { data, error } = await supabaseAdmin
          .from<any>('users')
          .insert({
            line_user_id: lineUserId,
            display_name: null,
            skill_level: 'beginner',
            total_requests: 1,
            last_active_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        return data
      }
    } catch (error) {
      console.error('UserQueries.createOrUpdate error:', error)
      // エラーでも最小限のユーザーオブジェクトを返す
      return {
        id: lineUserId,
        line_user_id: lineUserId,
        display_name: null,
        skill_level: 'beginner'
      }
    }
  }
  
  static async resetMonthlyUsage(userId: string) {
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        monthly_usage_count: 0,
        last_reset_date: new Date().toISOString()
      })
      .eq('id', userId)
    
    if (error) {
      console.error('Failed to reset monthly usage:', error)
    }
  }
  
  static async incrementUsageCount(userId: string) {
    const { data: user, error: fetchError } = await supabaseAdmin
      .from('users')
      .select('monthly_usage_count')
      .eq('id', userId)
      .maybeSingle()
    
    if (fetchError || !user) {
      console.error('Failed to fetch usage count:', fetchError)
      return
    }
    
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        monthly_usage_count: (user.monthly_usage_count || 0) + 1
      })
      .eq('id', userId)
    
    if (error) {
      console.error('Failed to increment usage count:', error)
    }
  }
}

export class QueueQueries {
  static async addToQueue(jobData: any) {
    try {
      const { data, error } = await supabaseAdmin
        .from('generation_queue')
        .insert(jobData)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('QueueQueries.addToQueue error:', error)
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
      const { data, error } = await supabaseAdmin
        .from('generation_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(batchSize)
      
      if (error) {
        console.error('Error getting next jobs:', error)
        return []
      }
      
      return data || []
    } catch (error) {
      console.error('QueueQueries.getNextJobs error:', error)
      return []
    }
  }
  
  static async getPendingJobsCount() {
    try {
      const { count, error } = await supabaseAdmin
        .from('generation_queue')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      
      if (error) {
        console.error('Error getting pending jobs count:', error)
        return 0
      }
      
      return count || 0
    } catch (error) {
      console.error('QueueQueries.getPendingJobsCount error:', error)
      return 0
    }
  }
  
  static async markJobProcessing(jobId: string) {
    try {
      const { error } = await supabaseAdmin
        .from('generation_queue')
        .update({
          status: 'processing',
          processed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      if (error) {
        console.error('Error marking job as processing:', error)
      }
    } catch (error) {
      console.error('QueueQueries.markJobProcessing error:', error)
    }
  }
  
  static async markJobCompleted(jobId: string) {
    try {
      const { error } = await supabaseAdmin
        .from('generation_queue')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      if (error) {
        console.error('Error marking job as completed:', error)
      }
    } catch (error) {
      console.error('QueueQueries.markJobCompleted error:', error)
    }
  }
  
  static async markJobFailed(jobId: string, errorMessage: string) {
    try {
      // リトライカウントを増やす
      const { data: job, error: fetchError } = await supabaseAdmin
        .from('generation_queue')
        .select('retry_count, max_retries')
        .eq('id', jobId)
        .single()
      
      if (fetchError || !job) {
        console.error('Error fetching job for retry:', fetchError)
        return
      }
      
      const newRetryCount = (job.retry_count || 0) + 1
      const status = newRetryCount >= (job.max_retries || 3) ? 'failed' : 'pending'
      
      const { error } = await supabaseAdmin
        .from('generation_queue')
        .update({
          status,
          retry_count: newRetryCount,
          error_message: errorMessage,
          processed_at: new Date().toISOString()
        })
        .eq('id', jobId)
      
      if (error) {
        console.error('Error marking job as failed:', error)
      }
    } catch (error) {
      console.error('QueueQueries.markJobFailed error:', error)
    }
  }
  
  static async updateJobStatus(jobId: string, updates: any) {
    try {
      const { error } = await supabaseAdmin
        .from('generation_queue')
        .update(updates)
        .eq('id', jobId)
      
      if (error) {
        console.error('Error updating job status:', error)
      }
    } catch (error) {
      console.error('QueueQueries.updateJobStatus error:', error)
    }
  }
}

export class UsageQueries {
  static async getDailyUsage(userId?: string) {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // userIdがない場合は全体の使用量を取得
      let query = supabaseAdmin
        .from('claude_usage')
        .select('total_tokens, total_cost')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false })
      
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query
      
      if (error) {
        console.error('Error getting daily usage:', error)
        return { tokens: 0, cost: 0, requests: 0 }
      }
      
      const totalTokens = data?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0
      const totalCost = data?.reduce((sum, row) => sum + (row.total_cost || 0), 0) || 0
      const totalRequests = data?.length || 0
      
      return { tokens: totalTokens, cost: totalCost, requests: totalRequests }
    } catch (error) {
      console.error('UsageQueries.getDailyUsage error:', error)
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
      const { error } = await supabaseAdmin
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
        console.error('Error logging Claude usage:', error)
      }
    } catch (error) {
      console.error('UsageQueries.logClaudeUsage error:', error)
    }
  }
  
  static async getMonthlyUsage(userId: string) {
    try {
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)
      
      const { data, error } = await supabaseAdmin
        .from('claude_usage')
        .select('total_tokens, total_cost')
        .eq('user_id', userId)
        .gte('created_at', startOfMonth.toISOString())
      
      if (error) {
        console.error('Error getting monthly usage:', error)
        return { tokens: 0, cost: 0 }
      }
      
      const totalTokens = data?.reduce((sum, row) => sum + (row.total_tokens || 0), 0) || 0
      const totalCost = data?.reduce((sum, row) => sum + (row.total_cost || 0), 0) || 0
      
      return { tokens: totalTokens, cost: totalCost }
    } catch (error) {
      console.error('UsageQueries.getMonthlyUsage error:', error)
      return { tokens: 0, cost: 0 }
    }
  }
}

export class MetricsQueries {
  static async recordMetric(metric: any) {
    try {
      const { error } = await supabaseAdmin
        .from('metrics')
        .insert({
          metric_type: metric.metric_type,
          metric_value: metric.metric_value,
          metadata: metric.metadata,
          created_at: new Date().toISOString()
        })
      
      if (error) {
        console.error('Error recording metric:', error)
      }
    } catch (error) {
      console.error('MetricsQueries.recordMetric error:', error)
    }
  }
}

export class SessionQueries {
  static async findActiveSession(userId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from<any>('conversation_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') throw error
      return data
    } catch (error) {
      console.error('SessionQueries.findActiveSession error:', error)
      return null
    }
  }

  static async createSession(userId: string, params: any = {}) {
    try {
      const { data, error } = await supabaseAdmin
        .from<any>('conversation_sessions')
        .insert({
          user_id: userId,
          status: params.status || 'active',
          current_step: 1,
          category: null,
          subcategory: null,
          collected_requirements: {}
        })
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('SessionQueries.createSession error:', error)
      // エラーでも最小限のセッションオブジェクトを返す
      return {
        id: `temp_${Date.now()}`,
        user_id: userId,
        status: 'active',
        current_step: 1
      }
    }
  }

  static async updateSession(sessionId: string, updates: any) {
    try {
      const { data, error } = await supabaseAdmin
        .from<any>('conversation_sessions')
        .update(updates)
        .eq('id', sessionId)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('SessionQueries.updateSession error:', error)
      return null
    }
  }

  static async completeSession(sessionId: string) {
    return await this.updateSession(sessionId, { status: 'completed' })
  }
}


export class CodeQueries {
  static async getRecentCodes(userId: string, limit: number = 3) {
    try {
      const { data, error } = await supabaseAdmin
        .from<any>('generated_codes')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit)
      
      if (error) throw error
      return data || []
    } catch (error) {
      console.error('CodeQueries.getRecentCodes error:', error)
      return []
    }
  }

  static async saveGeneratedCode(codeData: any) {
    try {
      // UUID型エラーを完全回避 - idカラムを明示的に除外
      const { id, ...cleanData } = codeData
      
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
      
      const { data, error } = await supabaseAdmin
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
      await supabaseAdmin
        .from<any>('claude_usage_logs')
        .insert(usageData)
    } catch (error) {
      console.error('ClaudeUsageQueries.logUsage error:', error)
    }
  }

  static async getUsageSummary(userId: string) {
    try {
      const { data, error } = await supabaseAdmin
        .from<any>('claude_usage_logs')
        .select('estimated_cost')
        .eq('user_id', userId)
      
      if (error) throw error
      
      const total = (data || []).reduce((sum: number, row: any) => 
        sum + (row.estimated_cost || 0), 0
      )
      
      return { total_cost: total, usage_count: (data || []).length }
    } catch (error) {
      console.error('ClaudeUsageQueries.getUsageSummary error:', error)
      return { total_cost: 0, usage_count: 0 }
    }
  }
}

export class ProcessingQueueQueries {
  static async addToQueue(jobData: any) {
    try {
      const { data, error } = await supabaseAdmin
        .from<any>('processing_queue')
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
      console.error('ProcessingQueueQueries.addToQueue error:', error)
      return null
    }
  }

  static async getNextJob() {
    try {
      const { data, error } = await supabaseAdmin
        .from<any>('processing_queue')
        .select('*')
        .eq('status', 'pending')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') throw error
      
      if (data) {
        await supabaseAdmin
          .from<any>('processing_queue')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', data.id)
      }
      
      return data
    } catch (error) {
      console.error('ProcessingQueueQueries.getNextJob error:', error)
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
      
      const { data, error } = await supabaseAdmin
        .from<any>('processing_queue')
        .update(updates)
        .eq('id', jobId)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('ProcessingQueueQueries.updateJobStatus error:', error)
      return null
    }
  }
}

// エクスポート
export default {
  UserQueries,
  SessionQueries,
  MetricsQueries,
  CodeQueries,
  ClaudeUsageQueries,
  QueueQueries,
  ProcessingQueueQueries,
  UsageQueries
}
