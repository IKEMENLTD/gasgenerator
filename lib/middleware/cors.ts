/**
 * CORS設定ミドルウェア
 * Cross-Origin Resource Sharingのセキュアな設定
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export interface CorsOptions {
  origin?: string | string[] | ((origin: string) => boolean)
  methods?: string[]
  allowedHeaders?: string[]
  exposedHeaders?: string[]
  credentials?: boolean
  maxAge?: number
  preflightContinue?: boolean
  optionsSuccessStatus?: number
}

export class CorsMiddleware {
  private static readonly DEFAULT_OPTIONS: CorsOptions = {
    origin: process.env.NODE_ENV === 'production' 
      ? (process.env.ALLOWED_ORIGINS?.split(',') || ['https://gasgenerator.onrender.com'])
      : ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-User-Id',
      'X-Session-Id'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-Id'
    ],
    credentials: true,
    maxAge: 86400, // 24時間
    optionsSuccessStatus: 204
  }

  /**
   * CORS設定の適用
   */
  static apply(
    req: NextRequest,
    res?: NextResponse,
    options: CorsOptions = {}
  ): NextResponse {
    const config = { ...this.DEFAULT_OPTIONS, ...options }
    const origin = req.headers.get('origin') || ''
    const response = res || NextResponse.next()

    // オリジンのチェック
    const isAllowed = this.isOriginAllowed(origin, config.origin)

    if (isAllowed) {
      // Access-Control-Allow-Origin
      response.headers.set('Access-Control-Allow-Origin', origin)
      
      // Vary ヘッダー（キャッシュ対策）
      const vary = response.headers.get('Vary')
      if (vary) {
        response.headers.set('Vary', `${vary}, Origin`)
      } else {
        response.headers.set('Vary', 'Origin')
      }
    }

    // Access-Control-Allow-Credentials
    if (config.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    // Preflightリクエストの処理
    if (req.method === 'OPTIONS') {
      // Access-Control-Allow-Methods
      if (config.methods) {
        response.headers.set(
          'Access-Control-Allow-Methods',
          config.methods.join(', ')
        )
      }

      // Access-Control-Allow-Headers
      if (config.allowedHeaders) {
        response.headers.set(
          'Access-Control-Allow-Headers',
          config.allowedHeaders.join(', ')
        )
      }

      // Access-Control-Max-Age
      if (config.maxAge) {
        response.headers.set('Access-Control-Max-Age', String(config.maxAge))
      }

      logger.debug('CORS preflight handled', {
        origin,
        allowed: isAllowed,
        method: req.method
      })

      return new NextResponse(null, { 
        status: config.optionsSuccessStatus,
        headers: response.headers
      })
    }

    // Access-Control-Expose-Headers
    if (config.exposedHeaders && config.exposedHeaders.length > 0) {
      response.headers.set(
        'Access-Control-Expose-Headers',
        config.exposedHeaders.join(', ')
      )
    }

    return response
  }

  /**
   * オリジンの許可チェック
   */
  private static isOriginAllowed(
    origin: string,
    allowedOrigins?: string | string[] | ((origin: string) => boolean)
  ): boolean {
    if (!allowedOrigins || !origin) {
      return false
    }

    // ワイルドカード（開発環境のみ）
    if (allowedOrigins === '*' && process.env.NODE_ENV !== 'production') {
      return true
    }

    // 関数による判定
    if (typeof allowedOrigins === 'function') {
      return allowedOrigins(origin)
    }

    // 文字列の場合
    if (typeof allowedOrigins === 'string') {
      return origin === allowedOrigins
    }

    // 配列の場合
    if (Array.isArray(allowedOrigins)) {
      return allowedOrigins.includes(origin)
    }

    return false
  }

  /**
   * 動的オリジン許可（ドメインパターンマッチング）
   */
  static createOriginMatcher(patterns: string[]): (origin: string) => boolean {
    return (origin: string) => {
      return patterns.some(pattern => {
        // 完全一致
        if (pattern === origin) return true
        
        // ワイルドカードパターン
        if (pattern.includes('*')) {
          const regex = new RegExp(
            '^' + pattern
              .replace(/\./g, '\\.')
              .replace(/\*/g, '.*')
            + '$'
          )
          return regex.test(origin)
        }
        
        // サブドメインマッチング
        if (pattern.startsWith('.')) {
          return origin.endsWith(pattern) || origin === pattern.slice(1)
        }
        
        return false
      })
    }
  }

  /**
   * API別のCORS設定
   */
  static getApiConfig(pathname: string): CorsOptions {
    // Webhook専用設定（LINE等からのアクセス）
    if (pathname.startsWith('/api/webhook')) {
      return {
        origin: '*', // Webhookは全オリジン許可
        methods: ['POST'],
        credentials: false
      }
    }

    // 管理者API
    if (pathname.startsWith('/api/admin')) {
      return {
        origin: process.env.ADMIN_ORIGIN?.split(',') || [],
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      }
    }

    // 公開API
    if (pathname.startsWith('/api/public')) {
      return {
        origin: '*',
        methods: ['GET'],
        credentials: false,
        maxAge: 3600 // 1時間
      }
    }

    // デフォルト
    return this.DEFAULT_OPTIONS
  }

  /**
   * セキュリティヘッダーの追加
   */
  static addSecurityHeaders(response: NextResponse): NextResponse {
    // X-Content-Type-Options
    response.headers.set('X-Content-Type-Options', 'nosniff')
    
    // X-Frame-Options
    response.headers.set('X-Frame-Options', 'DENY')
    
    // X-XSS-Protection
    response.headers.set('X-XSS-Protection', '1; mode=block')
    
    // Referrer-Policy
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    
    // Permissions-Policy
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), interest-cohort=()'
    )
    
    return response
  }

  /**
   * CSRFトークンの検証
   */
  static validateCsrfToken(req: NextRequest): boolean {
    // GETリクエストはスキップ
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
      return true
    }

    const token = req.headers.get('x-csrf-token') || 
                 req.cookies.get('csrf-token')?.value

    if (!token) {
      logger.warn('CSRF token missing', {
        method: req.method,
        path: new URL(req.url).pathname
      })
      return false
    }

    // トークン検証（実際の実装では暗号学的に安全な検証が必要）
    const sessionToken = req.cookies.get('session-csrf')?.value
    if (token !== sessionToken) {
      logger.warn('CSRF token mismatch', {
        method: req.method,
        path: new URL(req.url).pathname
      })
      return false
    }

    return true
  }
}

/**
 * CORS設定を適用するミドルウェア関数
 */
export function corsMiddleware(options?: CorsOptions) {
  return (req: NextRequest) => {
    const pathname = new URL(req.url).pathname
    const apiConfig = CorsMiddleware.getApiConfig(pathname)
    const mergedOptions = { ...apiConfig, ...options }
    
    const response = CorsMiddleware.apply(req, undefined, mergedOptions)
    
    // セキュリティヘッダーの追加
    if (process.env.NODE_ENV === 'production') {
      CorsMiddleware.addSecurityHeaders(response)
    }
    
    return response
  }
}

/**
 * 環境別のCORS設定プリセット
 */
export const corsPresets = {
  // 開発環境
  development: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'],
    credentials: true
  },
  
  // ステージング環境
  staging: {
    origin: CorsMiddleware.createOriginMatcher([
      '*.staging.gasgenerator.com',
      'https://staging.gasgenerator.com'
    ]),
    credentials: true
  },
  
  // 本番環境
  production: {
    origin: CorsMiddleware.createOriginMatcher([
      'https://gasgenerator.onrender.com',
      'https://www.gasgenerator.com',
      'https://gasgenerator.com'
    ]),
    credentials: true,
    maxAge: 86400
  },
  
  // Webhook用
  webhook: {
    origin: '*',
    methods: ['POST'],
    credentials: false
  },
  
  // 公開API用
  publicApi: {
    origin: '*',
    methods: ['GET'],
    credentials: false,
    maxAge: 3600
  }
}