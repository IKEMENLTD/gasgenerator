/**
 * エラーハンドリングユーティリティ
 * 本番環境では内部情報を隠蔽し、開発環境では詳細を表示
 */

import { NextResponse } from 'next/server'
import { logger } from './logger'

export interface SafeErrorResponse {
  error: string
  code?: string
  requestId?: string
  timestamp: string
  details?: any // 開発環境のみ
}

export class ErrorHandler {
  private static readonly ERROR_MESSAGES = {
    // 汎用エラーメッセージ
    INTERNAL_ERROR: 'An internal error occurred. Please try again later.',
    VALIDATION_ERROR: 'Invalid request data.',
    AUTHENTICATION_ERROR: 'Authentication failed.',
    AUTHORIZATION_ERROR: 'You do not have permission to perform this action.',
    NOT_FOUND: 'The requested resource was not found.',
    RATE_LIMIT: 'Too many requests. Please try again later.',
    SERVICE_UNAVAILABLE: 'Service is temporarily unavailable.',
    
    // API関連
    EXTERNAL_API_ERROR: 'External service error. Please try again later.',
    TIMEOUT_ERROR: 'Request timed out. Please try again.',
    
    // データベース関連
    DATABASE_ERROR: 'Database operation failed.',
    TRANSACTION_ERROR: 'Transaction could not be completed.',
    
    // ファイル関連
    FILE_UPLOAD_ERROR: 'File upload failed.',
    FILE_VALIDATION_ERROR: 'Invalid file format or size.',
  }
  
  /**
   * エラーレスポンスを生成
   */
  static createErrorResponse(
    error: unknown,
    statusCode: number = 500,
    requestId?: string
  ): NextResponse {
    const errorResponse = this.formatError(error, requestId)
    
    // ログ出力（詳細情報はログのみ）
    logger.error('API Error', {
      requestId,
      statusCode,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
      } : error
    })
    
    return NextResponse.json(errorResponse, { status: statusCode })
  }
  
  /**
   * エラーをフォーマット
   */
  static formatError(error: unknown, requestId?: string): SafeErrorResponse {
    const isProd = process.env.NODE_ENV === 'production'
    
    // エラーコードの判定
    const errorCode = this.getErrorCode(error)
    
    // エラーメッセージの取得（本番環境では汎用メッセージ）
    const message = isProd 
      ? this.getSafeErrorMessage(errorCode)
      : this.getDetailedErrorMessage(error)
    
    const response: SafeErrorResponse = {
      error: message,
      code: errorCode,
      requestId,
      timestamp: new Date().toISOString()
    }
    
    // 開発環境では詳細情報を含める
    if (!isProd && error instanceof Error) {
      response.details = {
        name: error.name,
        originalMessage: error.message,
        stack: error.stack?.split('\n').slice(0, 5) // スタックトレースは最初の5行のみ
      }
    }
    
    return response
  }
  
  /**
   * エラーコードを判定
   */
  private static getErrorCode(error: unknown): string {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      // 認証関連
      if (message.includes('unauthorized') || message.includes('authentication')) {
        return 'AUTH_ERROR'
      }
      
      // 権限関連
      if (message.includes('forbidden') || message.includes('permission')) {
        return 'PERMISSION_ERROR'
      }
      
      // バリデーション
      if (message.includes('validation') || message.includes('invalid')) {
        return 'VALIDATION_ERROR'
      }
      
      // レート制限
      if (message.includes('rate limit') || message.includes('too many')) {
        return 'RATE_LIMIT_ERROR'
      }
      
      // タイムアウト
      if (message.includes('timeout')) {
        return 'TIMEOUT_ERROR'
      }
      
      // データベース
      if (message.includes('database') || message.includes('supabase')) {
        return 'DATABASE_ERROR'
      }
      
      // 外部API
      if (message.includes('api') || message.includes('external')) {
        return 'EXTERNAL_API_ERROR'
      }
    }
    
    return 'INTERNAL_ERROR'
  }
  
  /**
   * 安全なエラーメッセージを取得（本番環境用）
   */
  private static getSafeErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'AUTH_ERROR':
        return this.ERROR_MESSAGES.AUTHENTICATION_ERROR
      case 'PERMISSION_ERROR':
        return this.ERROR_MESSAGES.AUTHORIZATION_ERROR
      case 'VALIDATION_ERROR':
        return this.ERROR_MESSAGES.VALIDATION_ERROR
      case 'RATE_LIMIT_ERROR':
        return this.ERROR_MESSAGES.RATE_LIMIT
      case 'TIMEOUT_ERROR':
        return this.ERROR_MESSAGES.TIMEOUT_ERROR
      case 'DATABASE_ERROR':
        return this.ERROR_MESSAGES.DATABASE_ERROR
      case 'EXTERNAL_API_ERROR':
        return this.ERROR_MESSAGES.EXTERNAL_API_ERROR
      default:
        return this.ERROR_MESSAGES.INTERNAL_ERROR
    }
  }
  
  /**
   * 詳細なエラーメッセージを取得（開発環境用）
   */
  private static getDetailedErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return `[${error.name}] ${error.message}`
    }
    
    if (typeof error === 'string') {
      return error
    }
    
    return JSON.stringify(error)
  }
  
  /**
   * HTTPステータスコードを判定
   */
  static getStatusCode(error: unknown): number {
    const errorCode = this.getErrorCode(error)
    
    switch (errorCode) {
      case 'AUTH_ERROR':
        return 401
      case 'PERMISSION_ERROR':
        return 403
      case 'VALIDATION_ERROR':
        return 400
      case 'RATE_LIMIT_ERROR':
        return 429
      case 'TIMEOUT_ERROR':
        return 408
      case 'DATABASE_ERROR':
        return 503
      default:
        return 500
    }
  }
  
  /**
   * エラーをラップ（チェーン用）
   */
  static wrap(error: unknown, context: string): Error {
    const originalMessage = error instanceof Error ? error.message : String(error)
    const wrappedError = new Error(`[${context}] ${originalMessage}`)
    
    if (error instanceof Error) {
      wrappedError.stack = error.stack
      wrappedError.name = error.name
    }
    
    return wrappedError
  }
  
  /**
   * 複数のエラーを集約
   */
  static aggregate(errors: Error[]): Error {
    if (errors.length === 0) {
      return new Error('Unknown error')
    }
    
    if (errors.length === 1) {
      return errors[0]
    }
    
    const messages = errors.map(e => e.message).join('; ')
    return new Error(`Multiple errors occurred: ${messages}`)
  }
}