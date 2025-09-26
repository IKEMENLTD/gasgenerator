/**
 * アプリケーション全体で使用する統一エラークラス
 */

export enum ErrorCode {
  // 認証・認可エラー (400番台)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  
  // リクエストエラー (400番台)
  BAD_REQUEST = 'BAD_REQUEST',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_PARAMETER = 'INVALID_PARAMETER',
  
  // リソースエラー (404)
  NOT_FOUND = 'NOT_FOUND',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  
  // 競合エラー (409)
  CONFLICT = 'CONFLICT',
  DUPLICATE_RESOURCE = 'DUPLICATE_RESOURCE',
  
  // レート制限 (429)
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  
  // サーバーエラー (500番台)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  
  // サービス利用不可 (503)
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  MAINTENANCE_MODE = 'MAINTENANCE_MODE',
}

export interface ErrorDetails {
  field?: string
  reason?: string
  suggestion?: string
  metadata?: Record<string, any>
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly details?: ErrorDetails
  public readonly isOperational: boolean
  public readonly timestamp: Date
  
  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    details?: ErrorDetails,
    isOperational: boolean = true
  ) {
    super(message)
    
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.details = details
    this.isOperational = isOperational
    this.timestamp = new Date()
    
    // スタックトレースを正しく設定
    Error.captureStackTrace(this, this.constructor)
  }
  
  /**
   * エラーをJSON形式に変換（クライアント向け）
   */
  toJSON(): Record<string, any> {
    const json: Record<string, any> = {
      error: {
        code: this.code,
        message: this.message,
        timestamp: this.timestamp.toISOString()
      }
    }
    
    // 開発環境では詳細情報を含める
    if (process.env.NODE_ENV !== 'production') {
      json.error.details = this.details
      json.error.stack = this.stack
    }
    
    return json
  }
  
  /**
   * エラーをログ用の形式に変換
   */
  toLogFormat(): Record<string, any> {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
      isOperational: this.isOperational,
      timestamp: this.timestamp,
      stack: this.stack
    }
  }
  
  // よく使うエラーのファクトリーメソッド
  static unauthorized(message: string = 'Unauthorized'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, 401)
  }
  
  static forbidden(message: string = 'Forbidden'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, 403)
  }
  
  static badRequest(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.BAD_REQUEST, message, 400, details)
  }
  
  static validationError(field: string, reason: string): AppError {
    return new AppError(
      ErrorCode.VALIDATION_ERROR,
      `Validation failed for field: ${field}`,
      400,
      { field, reason }
    )
  }
  
  static notFound(resource: string): AppError {
    return new AppError(
      ErrorCode.RESOURCE_NOT_FOUND,
      `${resource} not found`,
      404,
      { reason: `The requested ${resource} does not exist` }
    )
  }
  
  static conflict(message: string, details?: ErrorDetails): AppError {
    return new AppError(ErrorCode.CONFLICT, message, 409, details)
  }
  
  static rateLimitExceeded(retryAfter?: number): AppError {
    return new AppError(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      429,
      { 
        reason: 'Too many requests',
        suggestion: 'Please try again later',
        metadata: { retryAfter }
      }
    )
  }
  
  static internal(message: string = 'Internal server error'): AppError {
    return new AppError(ErrorCode.INTERNAL_ERROR, message, 500)
  }
  
  static databaseError(operation: string, error: any): AppError {
    return new AppError(
      ErrorCode.DATABASE_ERROR,
      `Database operation failed: ${operation}`,
      500,
      { 
        reason: error?.message || 'Unknown database error',
        metadata: { operation }
      },
      true // operational error
    )
  }
  
  static externalApiError(api: string, error: any): AppError {
    return new AppError(
      ErrorCode.EXTERNAL_API_ERROR,
      `External API error: ${api}`,
      502,
      {
        reason: error?.message || 'External service error',
        metadata: { api, originalError: error }
      }
    )
  }
}