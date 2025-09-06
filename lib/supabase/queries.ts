import { supabaseAdmin } from './client'

export class UserQueries {
  static async createOrUpdate(lineUserId: string) {
    try {
      // まず既存ユーザーを検索（maybeSingle使用）
      const { data: existingUser, error: findError } = await supabaseAdmin
        .from<any>('users')
        .select('*')
        .eq('line_user_id', lineUserId)
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
      // 仮のレスポンス
      return {
        id: `temp_${Date.now()}`,
        ...jobData,
        created_at: new Date().toISOString()
      }
    }
  }
  
  static async getNextJobs(batchSize: number) {
    return []
  }
  
  static async markJobProcessing(jobId: string) {
    return
  }
  
  static async markJobCompleted(jobId: string) {
    return
  }
  
  static async markJobFailed(jobId: string, errorMessage: string) {
    return
  }
  
  static async updateJobStatus(jobId: string, updates: any) {
    return
  }
}

export class MetricsQueries {
  static async recordMetric(metric: any) {
    // メトリクス記録（今は何もしない）
    return
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

export class MetricsQueries {
  static async recordMetric(metric: any) {
    try {
      await supabaseAdmin
        .from<any>('system_metrics')
        .insert(metric)
    } catch (error) {
      console.error('MetricsQueries.recordMetric error:', error)
    }
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
      const { data, error } = await supabaseAdmin
        .from<any>('generated_codes')
        .insert(codeData)
        .select()
        .single()
      
      if (error) throw error
      return data
    } catch (error) {
      console.error('CodeQueries.saveGeneratedCode error:', error)
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

export class QueueQueries {
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
      console.error('QueueQueries.addToQueue error:', error)
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
      console.error('QueueQueries.getNextJob error:', error)
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
      console.error('QueueQueries.updateJobStatus error:', error)
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
  QueueQueries
}
