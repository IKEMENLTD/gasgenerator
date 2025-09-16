// アプリケーション設定定数

// レート制限設定
export const RATE_LIMITS = {
  PER_USER_PER_HOUR: 20,
  GLOBAL_PER_MINUTE: 50,
  CLAUDE_API_PER_MINUTE: 5,
  CLAUDE_API_PER_DAY: 100
} as const

// タイムアウト設定
export const TIMEOUTS = {
  WEBHOOK_RESPONSE: 3000, // 3秒（LINE必須制限）
  CLAUDE_API: 45000, // 45秒
  DATABASE_QUERY: 10000, // 10秒
  HTTP_REQUEST: 30000 // 30秒
} as const

// Claude API設定
export const CLAUDE_CONFIG = {
  MODEL: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514', // Claude Sonnet 4 (環境変数で上書き可能)
  MAX_TOKENS: 32000, // コスト制御のため32Kに制限（それでも十分大きい）
  TEMPERATURE: 0.1,
  MAX_INPUT_TOKENS: 100000, // 100Kに制限（効率的な使用）
  // コスト計算（USD per 1000 tokens - Claude Sonnet 4料金）
  COST_PER_INPUT_TOKEN: 0.003 / 1000, // $3 per million tokens
  COST_PER_OUTPUT_TOKEN: 0.015 / 1000 // $15 per million tokens
} as const

// データベース設定
export const DATABASE_CONFIG = {
  MAX_SESSION_AGE_HOURS: 24,
  MAX_QUEUE_AGE_HOURS: 1,
  MAX_RETRIES: 3,
  CLEANUP_INTERVAL_MINUTES: 60,
  MAX_RECENT_CODES: 5
} as const

// 会話フロー設定
export const CONVERSATION_CONFIG = {
  MAX_STEPS: 3,
  MAX_REQUIREMENTS_LENGTH: 1000,
  MIN_DETAILS_LENGTH: 10
} as const

// キュー処理設定
export const QUEUE_CONFIG = {
  MAX_CONCURRENT_JOBS: 2,
  BATCH_SIZE: 5,
  PROCESSING_INTERVAL_MS: 60000, // 1分毎
  CLEANUP_INTERVAL_MS: 3600000 // 1時間毎
} as const

// ログ設定
export const LOG_CONFIG = {
  MAX_CONTEXT_SIZE: 1000,
  SENSITIVE_KEYS: ['password', 'token', 'secret', 'key', 'authorization'],
  LOG_RETENTION_DAYS: 7
} as const

// セキュリティ設定
export const SECURITY_CONFIG = {
  MIN_WEBHOOK_SECRET_LENGTH: 8,
  MAX_REQUEST_BODY_SIZE: 10000, // 10KB
  CORS_ALLOWED_ORIGINS: process.env.NODE_ENV === 'production' 
    ? ['https://line.me', 'https://api.line.me', 'https://webhook.line.me'] 
    : ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'] // 開発環境でも具体的なオリジンを指定
} as const

// 外部API設定
export const EXTERNAL_API_CONFIG = {
  LINE: {
    API_BASE_URL: 'https://api.line.me/v2/bot',
    PUSH_LIMIT_PER_MONTH: 1000
  },
  ANTHROPIC: {
    API_BASE_URL: 'https://api.anthropic.com/v1',
    API_VERSION: '2023-06-01'
  }
} as const

// メトリクス設定
export const METRICS_CONFIG = {
  COLLECTION_INTERVAL_MS: 300000, // 5分毎
  RETENTION_DAYS: 7,
  ALERT_THRESHOLDS: {
    ERROR_RATE: 0.05, // 5%
    RESPONSE_TIME: 5000, // 5秒
    QUEUE_LENGTH: 50
  }
} as const