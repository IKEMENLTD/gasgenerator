import { NextResponse } from 'next/server'
import { AppError, ErrorCode } from './app-error'
import { logger } from '@/lib/utils/logger'

/**
 * グローバルエラーハンドラー
 */
export class ErrorHandler {
  /**
   * エラーをハンドリングしてレスポンスを返す
   */
  static handleError(error: unknown): NextResponse {
    // AppErrorの場合
    if (error instanceof AppError) {
      logger.error('Application error', error.toLogFormat())
      
      return NextResponse.json(
        error.toJSON(),
        { status: error.statusCode }
      )
    }
    
    // その他のエラー
    logger.error('Unhandled error', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    })
    
    // 本番環境では詳細を隠す
    const message = process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : error instanceof Error ? error.message : 'Unknown error'
    
    const appError = new AppError(
      ErrorCode.INTERNAL_ERROR,
      message,
      500,
      undefined,
      false // non-operational
    )
    
    return NextResponse.json(
      appError.toJSON(),
      { status: 500 }
    )
  }
  
  /**
   * 非同期エラーをキャッチしてハンドリング
   */
  static async catchAsync<T>(
    fn: () => Promise<T>
  ): Promise<T | NextResponse> {
    try {
      return await fn()
    } catch (error) {
      return this.handleError(error)
    }
  }
  
  /**
   * エラーをログのみして続行
   */
  static logError(error: unknown, context?: Record<string, any>): void {
    if (error instanceof AppError) {
      logger.error('Application error (logged)', {
        ...error.toLogFormat(),
        context
      })
    } else {
      logger.error('Error (logged)', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        context
      })
    }
  }
  
  /**
   * エラーが再試行可能かチェック
   */
  static isRetryable(error: unknown): boolean {
    if (error instanceof AppError) {
      return [
        ErrorCode.RATE_LIMIT_EXCEEDED,
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorCode.EXTERNAL_API_ERROR
      ].includes(error.code)
    }
    
    // ネットワークエラーなど
    if (error instanceof Error) {
      const retryableMessages = [
        'ECONNRESET',
        'ETIMEDOUT',
        'ECONNREFUSED',
        'ENOTFOUND',
        'socket hang up'
      ]
      
      return retryableMessages.some(msg => 
        error.message.includes(msg)
      )
    }
    
    return false
  }
  
  /**
   * エラーをユーザーフレンドリーなメッセージに変換
   */
  static getUserMessage(error: unknown): string {
    if (error instanceof AppError) {
      switch (error.code) {
        case ErrorCode.UNAUTHORIZED:
          return '認証が必要です。ログインしてください。'
        case ErrorCode.FORBIDDEN:
          return 'このリソースへのアクセス権限がありません。'
        case ErrorCode.NOT_FOUND:
        case ErrorCode.RESOURCE_NOT_FOUND:
          return 'お探しのページが見つかりませんでした。'
        case ErrorCode.VALIDATION_ERROR:
          return '入力内容に誤りがあります。確認してください。'
        case ErrorCode.RATE_LIMIT_EXCEEDED:
          return 'リクエストが多すぎます。しばらく待ってから再試行してください。'
        case ErrorCode.SERVICE_UNAVAILABLE:
          return 'サービスが一時的に利用できません。しばらくお待ちください。'
        default:
          return 'エラーが発生しました。時間をおいて再試行してください。'
      }
    }
    
    return 'エラーが発生しました。時間をおいて再試行してください。'
  }
}