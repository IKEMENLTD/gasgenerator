/**
 * カスタムエラークラス
 */

export class BaseError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public context?: Record<string, any>
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', 400, context)
  }
}

export class AuthenticationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHENTICATION_ERROR', 401, context)
  }
}

export class AuthorizationError extends BaseError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'AUTHORIZATION_ERROR', 403, context)
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, identifier: string, context?: Record<string, any>) {
    super(
      `${resource} not found: ${identifier}`,
      'NOT_FOUND',
      404,
      { resource, identifier, ...context }
    )
  }
}

export class RateLimitError extends BaseError {
  constructor(limit: number, window: string, context?: Record<string, any>) {
    super(
      `Rate limit exceeded: ${limit} requests per ${window}`,
      'RATE_LIMIT_EXCEEDED',
      429,
      { limit, window, ...context }
    )
  }
}

export class ConfigurationError extends BaseError {
  constructor(service: string, reason: string, context?: Record<string, any>) {
    super(
      `${service} configuration error: ${reason}`,
      'CONFIGURATION_ERROR',
      500,
      { service, reason, ...context }
    )
  }
}

export class ExternalServiceError extends BaseError {
  constructor(service: string, originalError: any, context?: Record<string, any>) {
    super(
      `External service error: ${service}`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      { 
        service, 
        originalError: originalError?.message || String(originalError),
        ...context 
      }
    )
  }
}

export class DatabaseError extends BaseError {
  constructor(operation: string, table: string, originalError: any, context?: Record<string, any>) {
    super(
      `Database ${operation} failed on ${table}`,
      'DATABASE_ERROR',
      500,
      {
        operation,
        table,
        originalError: originalError?.message || String(originalError),
        ...context
      }
    )
  }
}

export class WebhookError extends BaseError {
  constructor(source: string, reason: string, context?: Record<string, any>) {
    super(
      `Webhook ${source} error: ${reason}`,
      'WEBHOOK_ERROR',
      400,
      { source, reason, ...context }
    )
  }
}

/**
 * エラーハンドラー
 */
export function handleError(error: unknown): {
  message: string
  code: string
  statusCode: number
  context?: Record<string, any>
} {
  if (error instanceof BaseError) {
    return {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      context: error.context
    }
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR',
      statusCode: 500,
      context: { name: error.name }
    }
  }
  
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR',
    statusCode: 500,
    context: { error: String(error) }
  }
}

/**
 * 安全なエラーメッセージを取得（ユーザー向け）
 */
export function getSafeErrorMessage(error: unknown): string {
  const handled = handleError(error)
  
  // 開発環境では詳細を表示
  if (process.env.NODE_ENV === 'development') {
    return `${handled.message} (${handled.code})`
  }
  
  // 本番環境では汎用メッセージ
  const safeMessages: Record<string, string> = {
    'VALIDATION_ERROR': '入力内容に誤りがあります',
    'AUTHENTICATION_ERROR': '認証に失敗しました',
    'AUTHORIZATION_ERROR': 'アクセス権限がありません',
    'NOT_FOUND': 'リソースが見つかりません',
    'RATE_LIMIT_EXCEEDED': 'アクセス制限に達しました。しばらくお待ちください',
    'CONFIGURATION_ERROR': 'システム設定エラーが発生しました',
    'EXTERNAL_SERVICE_ERROR': '外部サービスとの通信に失敗しました',
    'DATABASE_ERROR': 'データベースエラーが発生しました',
    'WEBHOOK_ERROR': 'Webhook処理に失敗しました'
  }
  
  return safeMessages[handled.code] || 'エラーが発生しました。しばらくしてから再度お試しください'
}