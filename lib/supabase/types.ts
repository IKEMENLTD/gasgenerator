export interface Database {
  public: {
    Tables: {
      tracking_links: {
        Row: {
          id: string
          code: string
          source: string
          campaign_name: string
          created_at: string
          created_by: string
          click_count: number
          friend_count: number
          is_active: boolean
        }
        Insert: {
          id?: string
          code: string
          source: string
          campaign_name: string
          created_at?: string
          created_by: string
          click_count?: number
          friend_count?: number
          is_active?: boolean
        }
        Update: {
          id?: string
          code?: string
          source?: string
          campaign_name?: string
          created_at?: string
          created_by?: string
          click_count?: number
          friend_count?: number
          is_active?: boolean
        }
      }
      tracking_sessions: {
        Row: {
          id: string
          tracking_link_id: string
          auth_token: string
          ip_address: string
          user_agent: string
          referer: string | null
          created_at: string
          expires_at: string
          is_bot: boolean
          line_user_id: string | null
          friend_added_at: string | null
        }
        Insert: {
          id?: string
          tracking_link_id: string
          auth_token: string
          ip_address: string
          user_agent: string
          referer?: string | null
          created_at?: string
          expires_at: string
          is_bot?: boolean
          line_user_id?: string | null
          friend_added_at?: string | null
        }
        Update: {
          id?: string
          tracking_link_id?: string
          auth_token?: string
          ip_address?: string
          user_agent?: string
          referer?: string | null
          created_at?: string
          expires_at?: string
          is_bot?: boolean
          line_user_id?: string | null
          friend_added_at?: string | null
        }
      }
      user_states: {
        Row: {
          id: string
          line_user_id: string
          display_name: string | null
          picture_url: string | null
          status_message: string | null
          language: string | null
          created_at: string
          updated_at: string
          state: any
        }
        Insert: {
          id?: string
          line_user_id: string
          display_name?: string | null
          picture_url?: string | null
          status_message?: string | null
          language?: string | null
          created_at?: string
          updated_at?: string
          state?: any
        }
        Update: {
          id?: string
          line_user_id?: string
          display_name?: string | null
          picture_url?: string | null
          status_message?: string | null
          language?: string | null
          created_at?: string
          updated_at?: string
          state?: any
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

export type TrackingLink = Database['public']['Tables']['tracking_links']['Row']
export type TrackingSession = Database['public']['Tables']['tracking_sessions']['Row']
export type UserState = Database['public']['Tables']['user_states']['Row']

export type InsertTrackingLink = Database['public']['Tables']['tracking_links']['Insert']
export type InsertTrackingSession = Database['public']['Tables']['tracking_sessions']['Insert']
export type InsertUserState = Database['public']['Tables']['user_states']['Insert']

export type UpdateTrackingLink = Database['public']['Tables']['tracking_links']['Update']
export type UpdateTrackingSession = Database['public']['Tables']['tracking_sessions']['Update']
export type UpdateUserState = Database['public']['Tables']['user_states']['Update']

// 新料金プラン・RAG関連の型をre-export
export * from './subscription-types'