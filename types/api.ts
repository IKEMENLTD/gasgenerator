// API リクエスト・レスポンス型定義

// 共通レスポンス型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    retryAfter?: number
  }
  timestamp: string
  requestId: string
}

// エラーコード
export type ErrorCode = 
  | 'INVALID_SIGNATURE'
  | 'RATE_LIMITED'
  | 'USER_NOT_FOUND'
  | 'SESSION_ERROR'
  | 'QUEUE_FULL'
  | 'INTERNAL_ERROR'

// Webhook関連
export interface WebhookProcessResult {
  processed: number
  replied: number
  queued: number
}

// ユーザー情報取得
export interface UserDataResponse {
  user: {
    id: string
    lineUserId: string
    skillLevel: 'beginner' | 'intermediate' | 'advanced'
    totalRequests: number
  }
  activeSession: {
    id: string
    currentStep: number
    category: string
    requirements: Record<string, any>
  } | null
  recentCodes: Array<{
    summary: string
    category: string
    createdAt: string
  }>
}

// セッション更新
export interface SessionUpdateRequest {
  currentStep: number
  requirements: Record<string, any>
  status: 'active' | 'ready_for_generation' | 'completed'
}

// キュー処理結果
export interface QueueProcessResult {
  processed: number
  errors: number
  remaining: number
}

// ヘルスチェック
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  database: 'connected' | 'error'
  externalApis: {
    line: 'healthy' | 'error'
    claude: 'healthy' | 'error'
  }
  queue: {
    pending: number
    processing: number
    failed: number
  }
}