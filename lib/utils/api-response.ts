import { NextResponse } from 'next/server'
import { ApiResponse, ApiError } from '@/types/api-types'
import { generateRequestId } from '@/lib/utils/crypto'
import { logger } from '@/lib/utils/logger'
import { SecurityHeaders } from '@/lib/middleware/security-headers'

export class ApiResponseBuilder {
  private static readonly API_VERSION = '1.0.0'

  /**
   * 成功レスポンスの作成
   */
  static success<T>(
    data: T,
    options: {
      statusCode?: number
      requestId?: string
      processingTime?: number
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { statusCode = 200, requestId = generateRequestId(), processingTime, headers = {} } = options

    const response: ApiResponse<T> = {
      success: true,
      data,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION,
        processingTime
      }
    }

    logger.debug('API success response', {
      requestId,
      statusCode,
      dataType: typeof data
    })

    const nextResponse = NextResponse.json(response, {
      status: statusCode,
      headers
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }

  /**
   * エラーレスポンスの作成
   */
  static error(
    error: {
      code: string
      message: string
      details?: Record<string, any>
    },
    options: {
      statusCode?: number
      requestId?: string
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { statusCode = 400, requestId = generateRequestId(), headers = {} } = options

    const apiError: ApiError = {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    }

    const response: ApiResponse = {
      success: false,
      error: apiError,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION
      }
    }

    logger.error('API error response', {
      requestId,
      statusCode,
      errorCode: error.code,
      errorMessage: error.message
    })

    const nextResponse = NextResponse.json(response, {
      status: statusCode,
      headers
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }

  /**
   * ページネーションレスポンスの作成
   */
  static paginated<T>(
    data: T[],
    pagination: {
      page: number
      limit: number
      total: number
    },
    options: {
      requestId?: string
      processingTime?: number
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { requestId = generateRequestId(), processingTime, headers = {} } = options
    const { page, limit, total } = pagination

    const totalPages = Math.ceil(total / limit)
    const hasNext = page < totalPages
    const hasPrevious = page > 1

    const response = {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext,
        hasPrevious
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION,
        processingTime
      }
    }

    logger.debug('API paginated response', {
      requestId,
      page,
      limit,
      total,
      dataCount: data.length
    })

    const nextResponse = NextResponse.json(response, {
      status: 200,
      headers
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }

  /**
   * 空レスポンス（204 No Content）
   */
  static noContent(
    options: {
      requestId?: string
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { requestId = generateRequestId(), headers = {} } = options

    logger.debug('API no content response', { requestId })

    const nextResponse = new NextResponse(null, {
      status: 204,
      headers
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }

  /**
   * リダイレクトレスポンス（セキュリティ検証付き）
   */
  static redirect(
    url: string,
    options: {
      statusCode?: 301 | 302 | 303 | 307 | 308
      requestId?: string
      headers?: HeadersInit
      allowExternal?: boolean
      baseDomain?: string
    } = {}
  ): NextResponse {
    const { 
      statusCode = 302, 
      requestId = generateRequestId(), 
      headers = {},
      allowExternal = false,
      baseDomain
    } = options

    // URLValidatorをインポート
    const { URLValidator } = require('@/lib/utils/url-validator')
    
    // URL検証
    if (!URLValidator.isValidRedirectURL(url, { allowExternal, baseDomain })) {
      logger.warn('Invalid redirect URL blocked', {
        requestId,
        url,
        allowExternal
      })
      
      // 安全なフォールバックURL
      const safeUrl = URLValidator.createSafeRedirectURL('/', baseDomain)
      
      return NextResponse.redirect(safeUrl, {
        status: statusCode,
        headers
      })
    }

    // URLのサニタイズ
    const sanitizedUrl = URLValidator.sanitizeURL(url)

    logger.info('API redirect response', {
      requestId,
      url: sanitizedUrl,
      statusCode
    })

    return NextResponse.redirect(sanitizedUrl, {
      status: statusCode,
      headers
    })
  }

  /**
   * 非同期ジョブ受付レスポンス
   */
  static accepted(
    jobId: string,
    options: {
      estimatedTime?: number
      statusUrl?: string
      requestId?: string
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { estimatedTime, statusUrl, requestId = generateRequestId(), headers = {} } = options

    const response = {
      success: true,
      data: {
        jobId,
        status: 'accepted',
        estimatedTime,
        statusUrl
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION
      }
    }

    logger.info('API job accepted', {
      requestId,
      jobId,
      estimatedTime
    })

    const nextResponse = NextResponse.json(response, {
      status: 202,
      headers: {
        ...headers,
        'Location': statusUrl || `/api/jobs/${jobId}`
      }
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }

  /**
   * バリデーションエラーレスポンス
   */
  static validationError(
    errors: Array<{
      field: string
      message: string
      code?: string
    }>,
    options: {
      requestId?: string
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { requestId = generateRequestId(), headers = {} } = options

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { errors },
        timestamp: new Date().toISOString()
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION
      }
    }

    logger.warn('API validation error', {
      requestId,
      errorCount: errors.length,
      errors
    })

    const nextResponse = NextResponse.json(response, {
      status: 422,
      headers
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }

  /**
   * レート制限エラーレスポンス
   */
  static rateLimitError(
    retryAfter: number,
    options: {
      requestId?: string
      limit?: number
      remaining?: number
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { requestId = generateRequestId(), limit, remaining, headers = {} } = options

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        details: {
          retryAfter,
          limit,
          remaining
        },
        timestamp: new Date().toISOString()
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION
      }
    }

    logger.warn('API rate limit exceeded', {
      requestId,
      retryAfter,
      limit,
      remaining
    })

    const nextResponse = NextResponse.json(response, {
      status: 429,
      headers: {
        ...headers,
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': limit?.toString() || '',
        'X-RateLimit-Remaining': remaining?.toString() || '0'
      }
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }

  /**
   * メンテナンスモードレスポンス
   */
  static maintenance(
    options: {
      message?: string
      estimatedEndTime?: string
      requestId?: string
      headers?: HeadersInit
    } = {}
  ): NextResponse {
    const { 
      message = 'System is under maintenance', 
      estimatedEndTime,
      requestId = generateRequestId(), 
      headers = {} 
    } = options

    const response: ApiResponse = {
      success: false,
      error: {
        code: 'MAINTENANCE_MODE',
        message,
        details: { estimatedEndTime },
        timestamp: new Date().toISOString()
      },
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        version: this.API_VERSION
      }
    }

    logger.info('API maintenance mode response', {
      requestId,
      estimatedEndTime
    })

    const nextResponse = NextResponse.json(response, {
      status: 503,
      headers: {
        ...headers,
        'Retry-After': '3600' // 1時間後に再試行
      }
    })

    return SecurityHeaders.applyAPIHeaders(nextResponse)
  }
}