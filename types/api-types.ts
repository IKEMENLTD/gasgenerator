/**
 * API関連の型定義
 */

// 基本的なAPIレスポンス型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: ApiError
  meta?: ApiMetadata
}

// エラー情報
export interface ApiError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: string
}

// メタデータ
export interface ApiMetadata {
  requestId: string
  timestamp: string
  version: string
  processingTime?: number
}

// ページネーション
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrevious: boolean
  }
}

// Webhook関連
export interface WebhookRequest {
  events: WebhookEvent[]
  destination?: string
  timestamp: number
}

export interface WebhookEvent {
  type: 'message' | 'follow' | 'unfollow' | 'join' | 'leave' | 'postback'
  mode: 'active' | 'standby'
  timestamp: number
  source: WebhookSource
  replyToken?: string
  message?: WebhookMessage
  postback?: WebhookPostback
}

export interface WebhookSource {
  type: 'user' | 'group' | 'room'
  userId?: string
  groupId?: string
  roomId?: string
}

export interface WebhookMessage {
  id: string
  type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'location' | 'sticker'
  text?: string
  fileName?: string
  fileSize?: number
  title?: string
  address?: string
  latitude?: number
  longitude?: number
  packageId?: string
  stickerId?: string
}

export interface WebhookPostback {
  data: string
  params?: Record<string, string>
}

// コード生成リクエスト
export interface GenerateCodeRequest {
  userId: string
  category: CodeCategory
  subcategory?: string
  requirements: CodeRequirements
  options?: GenerationOptions
}

export type CodeCategory = 
  | 'gmail'
  | 'calendar'
  | 'sheets'
  | 'drive'
  | 'forms'
  | 'docs'
  | 'slides'
  | 'other'

export interface CodeRequirements {
  description: string
  features: string[]
  constraints?: string[]
  examples?: string[]
  conversation?: ConversationMessage[]
}

export interface GenerationOptions {
  language?: 'javascript' | 'typescript'
  style?: 'minimal' | 'standard' | 'comprehensive'
  includeTests?: boolean
  includeDocumentation?: boolean
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
}

// コード生成レスポンス
export interface GenerateCodeResponse {
  jobId: string
  status: JobStatus
  code?: string
  gasUrl?: string
  error?: string
  createdAt: string
  completedAt?: string
}

export type JobStatus = 
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'

// キューのジョブ
export interface QueueJob {
  id: string
  userId: string
  status: JobStatus
  priority: number
  retryCount: number
  maxRetries: number
  requirements: CodeRequirements
  result?: GenerateCodeResult
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface GenerateCodeResult {
  code: string
  gasUrl: string
  metadata?: {
    linesOfCode: number
    complexity: number
    estimatedExecutionTime: number
  }
}

// ヘルスチェック
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  checks: {
    database: ComponentHealth
    lineApi: ComponentHealth
    anthropicApi: ComponentHealth
    environment: ComponentHealth
  }
  version?: string
}

export interface ComponentHealth {
  status: 'ok' | 'error' | 'warning'
  latency?: number
  error?: string
  details?: Record<string, any>
}

// 統計情報
export interface SystemStats {
  queue: QueueStats
  performance: PerformanceStats
  errors: ErrorStats
  cache: CacheStats
}

export interface QueueStats {
  pending: number
  processing: number
  completed: number
  failed: number
  averageProcessingTime: number
}

export interface PerformanceStats {
  averageResponseTime: number
  p95ResponseTime: number
  p99ResponseTime: number
  requestsPerMinute: number
  successRate: number
}

export interface ErrorStats {
  total: number
  byType: Record<string, number>
  bySeverity: {
    critical: number
    high: number
    medium: number
    low: number
  }
  errorRate: number
}

export interface CacheStats {
  hitRate: number
  missRate: number
  evictionRate: number
  totalEntries: number
  memoryUsage: number
}

// 認証関連
export interface AuthRequest {
  provider: 'line' | 'google' | 'custom'
  credentials?: {
    username?: string
    password?: string
    token?: string
  }
}

export interface AuthResponse {
  authenticated: boolean
  user?: AuthUser
  token?: string
  refreshToken?: string
  expiresIn?: number
}

export interface AuthUser {
  id: string
  lineUserId?: string
  displayName?: string
  pictureUrl?: string
  email?: string
  roles?: string[]
  permissions?: string[]
}

// 設定管理
export interface SystemConfig {
  features: FeatureFlags
  limits: SystemLimits
  integrations: IntegrationConfig
}

export interface FeatureFlags {
  enableConversationalFlow: boolean
  enableImageProcessing: boolean
  enableFileUploads: boolean
  enableNotifications: boolean
  enableAnalytics: boolean
  maintenanceMode: boolean
}

export interface SystemLimits {
  maxRequestsPerMinute: number
  maxQueueSize: number
  maxFileSize: number
  maxConversationLength: number
  maxCodeLength: number
}

export interface IntegrationConfig {
  line: {
    enabled: boolean
    channelId: string
    webhookUrl: string
  }
  anthropic: {
    enabled: boolean
    model: string
    maxTokens: number
  }
  supabase: {
    enabled: boolean
    projectUrl: string
  }
}