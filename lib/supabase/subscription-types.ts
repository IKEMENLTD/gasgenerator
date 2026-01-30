/**
 * サブスクリプション・システムカタログ・RAG関連の型定義
 *
 * 2026-01-27: 新料金プラン対応
 */

// ===================================================================
// サブスクリプションプラン
// ===================================================================

export interface SubscriptionPlan {
  id: string
  name: 'basic' | 'professional'
  display_name: string
  price_monthly: number
  contract_months: number
  viewable_systems: number | null  // null = 無制限
  monthly_downloads: number
  free_support_sessions: number
  support_price: number
  stripe_price_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface InsertSubscriptionPlan {
  name: string
  display_name: string
  price_monthly: number
  contract_months?: number
  viewable_systems?: number | null
  monthly_downloads: number
  free_support_sessions?: number
  support_price?: number
  stripe_price_id?: string | null
  is_active?: boolean
}

// ===================================================================
// ユーザーサブスクリプション
// ===================================================================

export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'pending'

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  started_at: string
  expires_at: string
  cancelled_at: string | null
  downloads_this_month: number
  support_sessions_this_month: number
  usage_reset_at: string
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface UserSubscriptionWithPlan extends UserSubscription {
  plan: SubscriptionPlan
}

export interface InsertUserSubscription {
  user_id: string
  plan_id: string
  status?: SubscriptionStatus
  started_at?: string
  expires_at: string
  stripe_subscription_id?: string | null
}

export interface UpdateUserSubscription {
  status?: SubscriptionStatus
  expires_at?: string
  cancelled_at?: string
  downloads_this_month?: number
  support_sessions_this_month?: number
}

// ===================================================================
// システムカタログ
// ===================================================================

export type SystemCategory = 'spreadsheet' | 'calendar' | 'email' | 'form' | 'document' | 'api' | 'other'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface System {
  id: string
  name: string
  slug: string
  description: string | null
  category: SystemCategory | null
  developer_name: string | null
  developed_at: string | null
  code_content: string | null
  setup_instructions: string | null
  thumbnail_url: string | null
  demo_video_url: string | null
  difficulty_level: DifficultyLevel
  estimated_time_minutes: number | null
  download_count: number
  view_count: number
  rating_average: number
  rating_count: number
  is_published: boolean
  is_featured: boolean
  created_at: string
  updated_at: string
}

export interface InsertSystem {
  name: string
  slug: string
  description?: string
  category?: SystemCategory
  developer_name?: string
  developed_at?: string
  code_content?: string
  setup_instructions?: string
  thumbnail_url?: string
  demo_video_url?: string
  difficulty_level?: DifficultyLevel
  estimated_time_minutes?: number
  is_published?: boolean
  is_featured?: boolean
}

export interface UpdateSystem {
  name?: string
  description?: string
  category?: SystemCategory
  code_content?: string
  setup_instructions?: string
  thumbnail_url?: string
  demo_video_url?: string
  difficulty_level?: DifficultyLevel
  estimated_time_minutes?: number
  is_published?: boolean
  is_featured?: boolean
}

// ===================================================================
// システムドキュメント（RAG用）
// ===================================================================

export type DocumentType = 'requirements' | 'design' | 'user_manual' | 'faq'

export interface SystemDocument {
  id: string
  system_id: string
  doc_type: DocumentType
  title: string
  content: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface InsertSystemDocument {
  system_id: string
  doc_type: DocumentType
  title: string
  content: string
  metadata?: Record<string, unknown>
}

// ===================================================================
// ベクトル埋め込み（RAG用）
// ===================================================================

export interface SystemEmbedding {
  id: string
  system_id: string
  document_id: string | null
  chunk_index: number
  chunk_text: string
  embedding_json: number[] | null  // pgvectorが使えない場合のJSON配列
  metadata: Record<string, unknown>
  created_at: string
}

export interface InsertSystemEmbedding {
  system_id: string
  document_id?: string
  chunk_index: number
  chunk_text: string
  embedding_json?: number[]
  metadata?: Record<string, unknown>
}

// ===================================================================
// ダウンロード履歴
// ===================================================================

export interface UserDownload {
  id: string
  user_id: string
  system_id: string
  subscription_id: string | null
  downloaded_at: string
  ip_address: string | null
  user_agent: string | null
  is_revoked: boolean
  revoked_at: string | null
  revoke_reason: string | null
}

export interface InsertUserDownload {
  user_id: string
  system_id: string
  subscription_id?: string
  ip_address?: string
  user_agent?: string
}

// ===================================================================
// システムアクセス権
// ===================================================================

export type AccessType = 'view' | 'download'

export interface UserSystemAccess {
  id: string
  user_id: string
  system_id: string
  access_type: AccessType
  granted_at: string
  granted_by: string | null
  expires_at: string | null
  is_active: boolean
}

export interface InsertUserSystemAccess {
  user_id: string
  system_id: string
  access_type: AccessType
  granted_by?: string
  expires_at?: string
}

// ===================================================================
// RPC関数の戻り値型
// ===================================================================

export interface CanDownloadResult {
  can_download: boolean
  reason: 'ok' | 'no_subscription' | 'download_limit_reached' | 'already_downloaded'
  message: string
  current?: number
  limit?: number
  remaining?: number
  next_period?: string  // 次回ダウンロード可能日（ISO 8601形式）
}

export interface ExecuteDownloadResult {
  success?: boolean
  can_download?: boolean
  download_id?: string
  reason?: string
  message: string
  remaining?: number  // 残りダウンロード回数
}

// ===================================================================
// ビュー用の拡張型
// ===================================================================

export interface SystemWithDocuments extends System {
  documents: SystemDocument[]
}

export interface SystemListItem {
  id: string
  name: string
  slug: string
  description: string | null
  category: SystemCategory | null
  thumbnail_url: string | null
  difficulty_level: DifficultyLevel
  download_count: number
  is_featured: boolean
}

export interface UserSubscriptionSummary {
  has_active_subscription: boolean
  plan_name: string | null
  plan_display_name: string | null
  expires_at: string | null
  downloads_remaining: number
  downloads_limit: number
  viewable_systems_count: number | null
}
