/**
 * コード共有機能の型定義
 */

// ========================================
// データベーステーブルの型
// ========================================

/**
 * code_sharesテーブルの型
 */
export interface CodeShare {
  // 基本情報
  id: string // UUID
  short_id: string // 8文字の短縮ID
  version: number

  // 関連情報
  user_id: string // LINE User ID
  job_id?: string // processing_queueのID（TEXT型）
  session_id?: string // conversation_sessionsのsession_id_text
  parent_id?: string // 親コードのID（修正版の場合）

  // コード情報
  title: string
  description?: string
  code_content: string
  language: string
  file_name: string

  // アクセス設定
  is_public: boolean
  password_hash?: string
  max_views?: number

  // メタデータ
  metadata: Record<string, any>
  tags: string[]
  conversation_context?: ConversationContextSnapshot
  requirements?: CodeRequirements

  // 統計情報
  view_count: number
  copy_count: number
  last_viewed_at?: Date

  // フラグ
  is_premium: boolean
  is_deleted: boolean
  deletion_reason?: string

  // タイムスタンプ
  expires_at: Date
  created_at: Date
  updated_at: Date
}

/**
 * code_share_access_logsテーブルの型
 */
export interface CodeShareAccessLog {
  id: string
  share_id: string

  // アクセス情報
  ip_address?: string
  user_agent?: string
  referer?: string
  access_type: AccessType

  // デバイス情報
  device_type?: DeviceType
  browser?: string
  os?: string

  // タイムスタンプ
  accessed_at: Date
}

/**
 * conversation_code_relationsテーブルの型
 */
export interface ConversationCodeRelation {
  id: string
  user_id: string
  session_id?: string
  share_id: string

  // 関連性情報
  relation_type: RelationType
  context_snapshot?: ConversationContextSnapshot

  // タイムスタンプ
  created_at: Date
}

/**
 * user_code_historyテーブルの型
 */
export interface UserCodeHistory {
  id: string
  user_id: string
  share_id: string

  // アクション情報
  action: HistoryAction
  action_details?: Record<string, any>

  // タイムスタンプ
  performed_at: Date
}

// ========================================
// Enum型定義
// ========================================

export type AccessType = 'view' | 'copy' | 'download'
export type DeviceType = 'mobile' | 'desktop' | 'tablet'
export type RelationType = 'original' | 'modified' | 'reference'
export type HistoryAction = 'generated' | 'modified' | 'viewed' | 'copied' | 'deleted'

// ========================================
// 会話コンテキストのスナップショット型
// ========================================

export interface ConversationContextSnapshot {
  session_id: string
  category?: string
  subcategory?: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp?: number
  }>
  extracted_requirements?: Record<string, any>
  ready_for_code?: boolean
  last_generated_code?: boolean
}

// ========================================
// コード要件の型
// ========================================

export interface CodeRequirements {
  category?: string
  subcategory?: string
  details?: string
  prompt?: string
  modifications?: string
  image_content?: string
  error_screenshot?: string
  is_error_fix?: boolean
  has_screenshot?: boolean
  additional_description?: string
}

// ========================================
// API リクエスト/レスポンス型
// ========================================

/**
 * コード共有作成リクエスト
 */
export interface CreateCodeShareRequest {
  code: string
  title: string
  description?: string
  userId: string
  jobId?: string // TEXT型のID
  sessionId?: string // TEXT型のsession_id
  parentId?: string // UUID型（code_sharesテーブルの親ID）
  requirements?: CodeRequirements
  conversationContext?: ConversationContextSnapshot
  options?: {
    password?: string
    maxViews?: number
    expiresInDays?: number // デフォルト: 7日（無料）、30日（プレミアム）
    tags?: string[]
  }
}

/**
 * コード共有作成レスポンス
 */
export interface CreateCodeShareResponse {
  success: boolean
  data: {
    id: string
    shortId: string
    url: string
    expiresAt: string
    qrCode?: string // Base64エンコードされたQRコード画像
  }
  error?: string
}

/**
 * コード共有取得リクエスト
 */
export interface GetCodeShareRequest {
  shortId: string
  password?: string
}

/**
 * コード共有取得レスポンス
 */
export interface GetCodeShareResponse {
  success: boolean
  data?: {
    title: string
    description?: string
    code: string
    language: string
    fileName: string
    createdAt: string
    updatedAt: string
    expiresAt: string
    viewCount: number
    copyCount: number
    isExpired: boolean
    isPremium: boolean
    tags: string[]
    author?: {
      isPremium: boolean
    }
    relatedCodes?: Array<{
      id: string
      shortId: string
      title: string
      relationType: RelationType
    }>
  }
  error?: string
  errorCode?: ShareErrorCode
}

/**
 * コード共有更新リクエスト
 */
export interface UpdateCodeShareRequest {
  shortId: string
  userId: string
  updates: {
    title?: string
    description?: string
    tags?: string[]
    isPublic?: boolean
    password?: string | null // nullでパスワード削除
    maxViews?: number | null
  }
}

/**
 * コード共有削除リクエスト
 */
export interface DeleteCodeShareRequest {
  shortId: string
  userId: string
  reason?: string
}

/**
 * コード共有統計取得レスポンス
 */
export interface CodeShareStatsResponse {
  totalViews: number
  totalCopies: number
  uniqueVisitors: number
  deviceStats: {
    mobile: number
    desktop: number
    tablet: number
  }
  accessLogs: Array<{
    accessedAt: string
    accessType: AccessType
    deviceType?: DeviceType
  }>
}

// ========================================
// エラーコード
// ========================================

export enum ShareErrorCode {
  NOT_FOUND = 'SHARE_NOT_FOUND',
  EXPIRED = 'SHARE_EXPIRED',
  PASSWORD_REQUIRED = 'PASSWORD_REQUIRED',
  INVALID_PASSWORD = 'INVALID_PASSWORD',
  RATE_LIMITED = 'RATE_LIMITED',
  MAX_VIEWS_REACHED = 'MAX_VIEWS_REACHED',
  DELETED = 'SHARE_DELETED',
  INVALID_SHORT_ID = 'INVALID_SHORT_ID',
  CREATION_FAILED = 'CREATION_FAILED',
  UNAUTHORIZED = 'UNAUTHORIZED'
}

// ========================================
// ユーティリティ型
// ========================================

/**
 * コード共有の作成パラメータ（内部用）
 */
export interface CreateCodeShareParams {
  userId: string
  code: string
  title: string
  description?: string
  jobId?: string
  sessionId?: string
  parentId?: string
  requirements?: CodeRequirements
  conversationContext?: ConversationContextSnapshot
  expiresInDays: number
  isPremium: boolean
  password?: string
  maxViews?: number
  tags?: string[]
}

/**
 * コード共有の検索条件
 */
export interface CodeShareSearchCriteria {
  userId?: string
  tags?: string[]
  isPublic?: boolean
  isPremium?: boolean
  createdAfter?: Date
  createdBefore?: Date
  limit?: number
  offset?: number
  orderBy?: 'created_at' | 'view_count' | 'copy_count'
  orderDirection?: 'asc' | 'desc'
}

/**
 * コード共有のサマリー情報
 */
export interface CodeShareSummary {
  id: string
  shortId: string
  title: string
  description?: string
  language: string
  tags: string[]
  viewCount: number
  copyCount: number
  createdAt: Date
  expiresAt: Date
  isExpired: boolean
  isPremium: boolean
}