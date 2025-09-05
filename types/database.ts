// Supabaseから自動生成される型定義
// 実際の環境では: supabase gen types typescript --project-id YOUR_PROJECT_ID > types/database.ts

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          line_user_id: string
          display_name: string | null
          skill_level: 'beginner' | 'intermediate' | 'advanced'
          total_requests: number
          last_active_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          line_user_id: string
          display_name?: string | null
          skill_level?: 'beginner' | 'intermediate' | 'advanced'
          total_requests?: number
          last_active_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          line_user_id?: string
          display_name?: string | null
          skill_level?: 'beginner' | 'intermediate' | 'advanced'
          total_requests?: number
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