#!/bin/bash

echo "🔧 ユーザークエリを修正中..."

# UserQueries.createOrUpdate を修正
cat > lib/supabase/queries.ts << 'EOF'
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
        // Error finding user
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
      // UserQueries.createOrUpdate error
      // エラーでも最小限のユーザーオブジェクトを返す
      return {
        id: lineUserId,
        line_user_id: lineUserId,
        display_name: null,
        skill_level: 'beginner'
      }
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
      // SessionQueries.findActiveSession error
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
      // SessionQueries.createSession error
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
      // SessionQueries.updateSession error
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
      // MetricsQueries.recordMetric error
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
      // CodeQueries.getRecentCodes error
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
      // CodeQueries.saveGeneratedCode error
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
      // ClaudeUsageQueries.logUsage error
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
      // ClaudeUsageQueries.getUsageSummary error
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
      // QueueQueries.addToQueue error
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
      // QueueQueries.getNextJob error
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
      // QueueQueries.updateJobStatus error
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
EOF

echo "✅ クエリ修正完了"
echo ""
echo "📦 ビルドテスト中..."
npm run build 2>&1 | tail -5