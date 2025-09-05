import { NextResponse } from 'next/server'
import type { ApiResponse, ErrorCode } from '@/types/api'
import { logger } from './logger'

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryAfter?: number
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function createErrorResponse(
  code: ErrorCode, 
  message: string, 
  requestId?: string,
  retryAfter?: number
): NextResponse<ApiResponse> {
  const response: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      retryAfter
    },
    timestamp: new Date().toISOString(),
    requestId: requestId || `err_${Date.now()}`
  }

  // ログ出力
  logger.error('API Error Response', {
    code,
    message,
    requestId,
    retryAfter
  })

  return NextResponse.json(response)
}

export function createSuccessResponse<T>(
  data: T,
  requestId?: string
): NextResponse<ApiResponse<T>> {
  const response: ApiResponse<T> = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
    requestId: requestId || `req_${Date.now()}`
  }

  return NextResponse.json(response)
}

export function handleApiError(
  error: unknown,
  requestId?: string
): NextResponse<ApiResponse> {
  if (error instanceof AppError) {
    return createErrorResponse(error.code, error.message, requestId, error.retryAfter)
  }

  if (error instanceof Error) {
    logger.error('Unexpected API error', {
      error: error.message,
      stack: error.stack,
      requestId
    })
    return createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred', requestId)
  }

  logger.error('Unknown API error', { error, requestId })
  return createErrorResponse('INTERNAL_ERROR', 'An unknown error occurred', requestId)
}

// レート制限チェッカー
export class RateLimiter {
  private static requests = new Map<string, number[]>()

  static checkLimit(
    key: string, 
    maxRequests: number, 
    windowMs: number
  ): { allowed: boolean; retryAfter?: number } {
    const now = Date.now()
    const windowStart = now - windowMs
    
    // 既存のリクエスト記録を取得
    const requests = this.requests.get(key) || []
    
    // ウィンドウ内のリクエストのみ保持
    const validRequests = requests.filter(time => time > windowStart)
    
    if (validRequests.length >= maxRequests) {
      // 最も古いリクエストから制限時間を計算
      const oldestRequest = Math.min(...validRequests)
      const retryAfter = Math.ceil((oldestRequest + windowMs - now) / 1000)
      
      return { allowed: false, retryAfter }
    }
    
    // リクエストを記録
    validRequests.push(now)
    this.requests.set(key, validRequests)
    
    return { allowed: true }
  }

  // 定期的なクリーンアップ
  static cleanup(): void {
    const now = Date.now()
    const oneHourAgo = now - 60 * 60 * 1000
    
    for (const [key, requests] of this.requests.entries()) {
      const validRequests = requests.filter(time => time > oneHourAgo)
      if (validRequests.length === 0) {
        this.requests.delete(key)
      } else {
        this.requests.set(key, validRequests)
      }
    }
  }
}

// 定期的にレート制限キャッシュをクリーンアップ
setInterval(() => {
  RateLimiter.cleanup()
}, 10 * 60 * 1000) // 10分毎