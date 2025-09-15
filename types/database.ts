// Supabaseから自動生成される型定義
// 実際の環境では: supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          display_name: string  // LINE User IDを格納
          user_id: string | null  // 内部ID（実際のテーブルに合わせる）
          skill_level: 'beginner' | 'intermediate' | 'advanced'
          subscription_status: 'free' | 'premium'
          subscription_end_date: string | null
          subscription_started_at: string | null
          subscription_cancelled_at: string | null
          stripe_customer_id: string | null
          subscription_id: string | null  // 実際のテーブルに存在
          monthly_usage_count: number
          total_requests: number
          last_reset_date: string | null
          last_active_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          display_name: string  // LINE User IDを格納
          user_id?: string | null
          skill_level?: 'beginner' | 'intermediate' | 'advanced'
          subscription_status?: 'free' | 'premium'
          subscription_end_date?: string | null
          subscription_id?: string | null
          stripe_customer_id?: string | null
          monthly_usage_count?: number
          total_requests?: number
          last_reset_date?: string | null
          last_active_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string  // LINE User IDを格納
          user_id?: string | null
          skill_level?: 'beginner' | 'intermediate' | 'advanced'
          subscription_status?: 'free' | 'premium'
          subscription_end_date?: string | null
          subscription_id?: string | null
          stripe_customer_id?: string | null
          monthly_usage_count?: number
          total_requests?: number
          last_reset_date?: string | null
          last_active_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      conversation_sessions: {
        Row: {
          id: string
          user_id: string
          status: 'active' | 'ready_for_generation' | 'completed' | 'abandoned'
          current_step: number
          category: string | null
          subcategory: string | null
          collected_requirements: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          status?: 'active' | 'ready_for_generation' | 'completed' | 'abandoned'
          current_step?: number
          category?: string | null
          subcategory?: string | null
          collected_requirements?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          status?: 'active' | 'ready_for_generation' | 'completed' | 'abandoned'
          current_step?: number
          category?: string | null
          subcategory?: string | null
          collected_requirements?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      processing_queue: {
        Row: {
          id: string
          user_id: string
          line_user_id: string
          session_id: string
          requirements: Record<string, any>
          status: 'pending' | 'processing' | 'completed' | 'failed'
          priority: number
          retry_count: number
          max_retries: number
          created_at: string
          started_at: string | null
          completed_at: string | null
          error_message: string | null
        }
        Insert: {
          id?: string
          user_id: string
          line_user_id: string
          session_id: string
          requirements: Record<string, any>
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          priority?: number
          retry_count?: number
          max_retries?: number
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          line_user_id?: string
          session_id?: string
          requirements?: Record<string, any>
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          priority?: number
          retry_count?: number
          max_retries?: number
          created_at?: string
          started_at?: string | null
          completed_at?: string | null
          error_message?: string | null
        }
      }
      generated_codes: {
        Row: {
          id: string
          user_id: string
          session_id: string
          requirements_summary: string
          generated_code: string
          explanation: string
          usage_steps: string[]
          code_category: string
          code_subcategory: string | null
          claude_prompt: string
          claude_response_metadata: Record<string, any> | null
          user_feedback: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          requirements_summary: string
          generated_code: string
          explanation: string
          usage_steps: string[]
          code_category: string
          code_subcategory?: string | null
          claude_prompt: string
          claude_response_metadata?: Record<string, any> | null
          user_feedback?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          requirements_summary?: string
          generated_code?: string
          explanation?: string
          usage_steps?: string[]
          code_category?: string
          code_subcategory?: string | null
          claude_prompt?: string
          claude_response_metadata?: Record<string, any> | null
          user_feedback?: string | null
          created_at?: string
        }
      }
      claude_usage_logs: {
        Row: {
          id: string
          user_id: string | null
          request_type: string
          input_tokens: number
          output_tokens: number
          estimated_cost: number
          success: boolean
          error_type: string | null
          processing_time_ms: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          request_type?: string
          input_tokens?: number
          output_tokens?: number
          estimated_cost?: number
          success: boolean
          error_type?: string | null
          processing_time_ms?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          request_type?: string
          input_tokens?: number
          output_tokens?: number
          estimated_cost?: number
          success?: boolean
          error_type?: string | null
          processing_time_ms?: number | null
          created_at?: string
        }
      }
      vision_usage: {
        Row: {
          id: string
          user_id: string
          image_hash: string
          analysis_result: string
          status: 'processing' | 'completed' | 'failed'
          image_size_bytes: number | null
          processing_time_ms: number | null
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          image_hash: string
          analysis_result: string
          status?: 'processing' | 'completed' | 'failed'
          image_size_bytes?: number | null
          processing_time_ms?: number | null
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          image_hash?: string
          analysis_result?: string
          status?: 'processing' | 'completed' | 'failed'
          image_size_bytes?: number | null
          processing_time_ms?: number | null
          created_at?: string
          updated_at?: string | null
        }
      }
      stripe_events: {
        Row: {
          id: string
          event_id: string
          event_type: string
          processed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          event_type: string
          processed_at: string
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          event_type?: string
          processed_at?: string
          created_at?: string
        }
      }
      refunds: {
        Row: {
          id: string
          charge_id: string
          amount: number
          customer_id: string | null
          refunded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          charge_id: string
          amount: number
          customer_id?: string | null
          refunded_at: string
          created_at?: string
        }
        Update: {
          id?: string
          charge_id?: string
          amount?: number
          customer_id?: string | null
          refunded_at?: string
          created_at?: string
        }
      }
      generation_queue: {
        Row: {
          id: string
          user_id: string
          category: string
          requirements: any
          status: 'pending' | 'processing' | 'completed' | 'failed'
          created_at: string
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          category: string
          requirements: any
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          category?: string
          requirements?: any
          status?: 'pending' | 'processing' | 'completed' | 'failed'
          created_at?: string
          updated_at?: string | null
        }
      }
      system_metrics: {
        Row: {
          id: string
          metric_type: string
          metric_value: number
          metadata: Record<string, any> | null
          recorded_at: string
        }
        Insert: {
          id?: string
          metric_type: string
          metric_value: number
          metadata?: Record<string, any> | null
          recorded_at?: string
        }
        Update: {
          id?: string
          metric_type?: string
          metric_value?: number
          metadata?: Record<string, any> | null
          recorded_at?: string
        }
      }
      code_shares: {
        Row: {
          id: string
          short_id: string
          user_id: string
          job_id: string | null
          session_id: string | null
          parent_id: string | null
          version: number
          title: string
          description: string | null
          code_content: string
          language: string
          file_name: string
          is_public: boolean
          is_deleted: boolean
          deletion_reason: string | null
          password_hash: string | null
          max_views: number | null
          view_count: number
          copy_count: number
          last_viewed_at: string | null
          tags: string[] | null
          conversation_context: any | null
          requirements: string | null
          is_premium: boolean
          expires_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          short_id: string
          user_id: string
          job_id?: string | null
          session_id?: string | null
          parent_id?: string | null
          version?: number
          title: string
          description?: string | null
          code_content: string
          language?: string
          file_name?: string
          is_public?: boolean
          is_deleted?: boolean
          deletion_reason?: string | null
          password_hash?: string | null
          max_views?: number | null
          view_count?: number
          copy_count?: number
          last_viewed_at?: string | null
          tags?: string[] | null
          conversation_context?: any | null
          requirements?: string | null
          is_premium?: boolean
          expires_at: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          short_id?: string
          user_id?: string
          job_id?: string | null
          session_id?: string | null
          parent_id?: string | null
          version?: number
          title?: string
          description?: string | null
          code_content?: string
          language?: string
          file_name?: string
          is_public?: boolean
          is_deleted?: boolean
          deletion_reason?: string | null
          password_hash?: string | null
          max_views?: number | null
          view_count?: number
          copy_count?: number
          last_viewed_at?: string | null
          tags?: string[] | null
          conversation_context?: any | null
          requirements?: string | null
          is_premium?: boolean
          expires_at?: string
          created_at?: string
          updated_at?: string
        }
      }
      code_share_access_logs: {
        Row: {
          id: string
          share_id: string
          access_type: string
          ip_address: string | null
          user_agent: string | null
          referer: string | null
          device_type: string | null
          browser: string | null
          os: string | null
          accessed_at: string
        }
        Insert: {
          id?: string
          share_id: string
          access_type: string
          ip_address?: string | null
          user_agent?: string | null
          referer?: string | null
          device_type?: string | null
          browser?: string | null
          os?: string | null
          accessed_at?: string
        }
        Update: {
          id?: string
          share_id?: string
          access_type?: string
          ip_address?: string | null
          user_agent?: string | null
          referer?: string | null
          device_type?: string | null
          browser?: string | null
          os?: string | null
          accessed_at?: string
        }
      }
      conversation_code_relations: {
        Row: {
          id: string
          user_id: string
          session_id: string
          share_id: string
          relation_type: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          share_id: string
          relation_type: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          share_id?: string
          relation_type?: string
          created_at?: string
        }
      }
      user_code_history: {
        Row: {
          id: string
          user_id: string
          share_id: string
          action: string
          action_details: any | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          share_id: string
          action: string
          action_details?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          share_id?: string
          action?: string
          action_details?: any | null
          created_at?: string
        }
      }
    }
  }
}

// 便利な型エイリアス
export type User = Database['public']['Tables']['users']['Row']
export type UserInsert = Database['public']['Tables']['users']['Insert']
export type UserUpdate = Database['public']['Tables']['users']['Update']

export type ConversationSession = Database['public']['Tables']['conversation_sessions']['Row']
export type ConversationSessionInsert = Database['public']['Tables']['conversation_sessions']['Insert']
export type ConversationSessionUpdate = Database['public']['Tables']['conversation_sessions']['Update']

export type QueueJob = Database['public']['Tables']['processing_queue']['Row']
export type QueueJobInsert = Database['public']['Tables']['processing_queue']['Insert']
export type QueueJobUpdate = Database['public']['Tables']['processing_queue']['Update']

export type GeneratedCode = Database['public']['Tables']['generated_codes']['Row']
export type GeneratedCodeInsert = Database['public']['Tables']['generated_codes']['Insert']

export type ClaudeUsageLog = Database['public']['Tables']['claude_usage_logs']['Row']
export type ClaudeUsageLogInsert = Database['public']['Tables']['claude_usage_logs']['Insert']

export type SystemMetric = Database['public']['Tables']['system_metrics']['Row']
export type SystemMetricInsert = Database['public']['Tables']['system_metrics']['Insert']