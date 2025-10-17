// Claude API関連の型定義

// Claude API Request
export interface ClaudeApiRequest {
  model: string
  max_tokens: number
  temperature: number
  messages: ClaudeMessage[]
}

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

// Claude Vision API用のコンテンツブロック
export interface ClaudeContentBlock {
  type: 'text' | 'image'
  text?: string
  source?: {
    type: string
    media_type: string
    data: string
  }
}

// Claude API Response
export interface ClaudeApiResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeContent[]
  model: string
  stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence'
  stop_sequence: string | null
  usage: ClaudeUsage
}

export interface ClaudeContent {
  type: 'text'
  text: string
}

export interface ClaudeUsage {
  input_tokens: number
  output_tokens: number
}

// コード生成レスポンス（パース後）
export interface ClaudeCodeResponse {
  code: string
  explanation: string
  steps: string[]
  summary?: string
  notes?: string[]
}

// プロンプト構築用
export interface CodeGenerationRequest {
  userId: string
  lineUserId: string
  sessionId: string
  category: string
  subcategory?: string
  requirements: {
    category?: string
    subcategory?: string
    step1?: string
    step2?: string
    step3?: string
    details: string
  }
  userHistory?: UserCodeHistory[]
}

export interface UserCodeHistory {
  category: string
  subcategory?: string
  feedback: 'success' | 'error' | 'modified' | null
  createdAt: string
}

// プロンプト部品
export interface PromptComponents {
  systemPrompt: string
  userContext: string
  categoryContext: string
  requestDetails: string
}

// Claude API クライアント設定
export interface ClaudeConfig {
  apiKey: string
  model: string
  maxTokens: number
  temperature: number
  timeout: number
}

// エラー型
export interface ClaudeApiError {
  type: 'rate_limit' | 'timeout' | 'invalid_response' | 'network_error' | 'auth_error'
  message: string
  retryAfter?: number
}