import { NextRequest, NextResponse } from 'next/server'

export class SecurityHeaders {
  /**
   * セキュリティヘッダーを追加
   */
  static apply(response: NextResponse): NextResponse {
    // Content Security Policy
    response.headers.set(
      'Content-Security-Policy',
      this.getCSP()
    )

    // その他のセキュリティヘッダー
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-XSS-Protection', '1; mode=block')
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
    
    // HSTS（本番環境のみ）
    if (process.env.NODE_ENV === 'production') {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      )
    }

    return response
  }

  /**
   * Content Security Policyの生成
   */
  private static getCSP(): string {
    const isProd = process.env.NODE_ENV === 'production'
    
    const directives = {
      'default-src': ["'self'"],
      'script-src': isProd ? [
        "'self'",
        "'nonce-{NONCE_PLACEHOLDER}'", // nonceベースのインラインスクリプト（本番環境）
        'https://cdn.jsdelivr.net'
      ] : [
        "'self'",
        "'unsafe-inline'", // 開発環境のみ
        "'unsafe-eval'", // 開発環境のみ
        'https://cdn.jsdelivr.net'
      ],
      'style-src': isProd ? [
        "'self'",
        "'nonce-{NONCE_PLACEHOLDER}'" // nonceベースのインラインスタイル（本番環境）
      ] : [
        "'self'",
        "'unsafe-inline'" // 開発環境のみ
      ],
      'img-src': [
        "'self'",
        'data:',
        'https:',
        'blob:'
      ],
      'font-src': ["'self'", 'data:'],
      'connect-src': [
        "'self'",
        'https://*.supabase.co', // Supabase
        'https://api.line.me', // LINE API
        'https://api.anthropic.com', // Claude API
        'wss://*.supabase.co' // Supabase Realtime
      ],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': []
    }

    // 開発環境の調整
    if (process.env.NODE_ENV === 'development') {
      directives['connect-src'].push('ws://localhost:*')
      directives['connect-src'].push('http://localhost:*')
    }

    return Object.entries(directives)
      .map(([key, values]) => {
        if (values.length === 0) return key
        return `${key} ${values.join(' ')}`
      })
      .join('; ')
  }

  /**
   * CORSヘッダーを設定
   */
  static setCORSHeaders(request: NextRequest, response: NextResponse): NextResponse {
    const origin = request.headers.get('origin')
    const allowedOrigins = this.getAllowedOrigins()

    // オリジンチェック（ワイルドカードは使用しない）
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin)
    }
    // 不明なオリジンからのリクエストはCORSヘッダーを設定しない

    // その他のCORSヘッダー
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    )
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Line-Signature, X-User-Id'
    )
    response.headers.set('Access-Control-Max-Age', '86400')
    // credentialsを使う場合はワイルドカードオリジンは使用不可
    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }

    return response
  }

  /**
   * 許可するオリジンのリスト
   */
  private static getAllowedOrigins(): string[] {
    const origins = [
      'https://api.line.me',
      'https://webhook.line.me'
    ]

    // 環境変数から追加のオリジンを読み込み
    if (process.env.ALLOWED_ORIGINS) {
      origins.push(...process.env.ALLOWED_ORIGINS.split(','))
    }

    // 開発環境
    if (process.env.NODE_ENV === 'development') {
      origins.push('http://localhost:3000')
      origins.push('http://localhost:3001')
    }

    return origins
  }

  /**
   * API専用のセキュリティヘッダー
   */
  static applyAPIHeaders(response: NextResponse): NextResponse {
    // APIレスポンス用の追加ヘッダー
    response.headers.set('Content-Type', 'application/json; charset=utf-8')
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    // APIバージョン情報
    response.headers.set('X-API-Version', '1.0.0')
    
    return this.apply(response)
  }

  /**
   * Webhookエンドポイント用のヘッダー
   */
  static applyWebhookHeaders(response: NextResponse): NextResponse {
    // Webhook特有の設定
    response.headers.set('X-Webhook-Version', '1.0.0')
    
    // LINEからのリクエストのみ許可するヘッダー
    response.headers.set('X-Accepted-Webhook-Types', 'line')
    
    return this.applyAPIHeaders(response)
  }

  /**
   * リクエストの検証
   */
  static validateRequest(request: NextRequest): { valid: boolean; reason?: string } {
    // User-Agentチェック
    const userAgent = request.headers.get('user-agent')
    if (!userAgent) {
      return { valid: false, reason: 'Missing User-Agent header' }
    }

    // 悪意のあるUser-Agentのブロック
    const blockedAgents = [
      'sqlmap',
      'nikto',
      'nessus',
      'metasploit',
      'burp'
    ]
    
    const lowerUserAgent = userAgent.toLowerCase()
    for (const blocked of blockedAgents) {
      if (lowerUserAgent.includes(blocked)) {
        return { valid: false, reason: `Blocked User-Agent: ${blocked}` }
      }
    }

    // Content-Typeチェック（POSTリクエストの場合）
    if (request.method === 'POST' || request.method === 'PUT') {
      const contentType = request.headers.get('content-type')
      if (!contentType) {
        return { valid: false, reason: 'Missing Content-Type header' }
      }
    }

    return { valid: true }
  }
}