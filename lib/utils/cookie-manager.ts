/**
 * セキュアなCookie管理ユーティリティ
 * HTTPOnly, Secure, SameSite属性を適切に設定
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from './logger'
import { CryptoUtils } from './crypto-utils'

export interface CookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'strict' | 'lax' | 'none'
  maxAge?: number
  expires?: Date
  path?: string
  domain?: string
  signed?: boolean
  encrypted?: boolean
}

export class CookieManager {
  private static readonly DEFAULT_OPTIONS: CookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    signed: true
  }

  // Cookie名のプレフィックス（セキュリティ強化）
  private static readonly SECURE_PREFIX = '__Secure-'
  private static readonly HOST_PREFIX = '__Host-'

  // セッション用デフォルト設定
  private static readonly SESSION_OPTIONS: CookieOptions = {
    ...CookieManager.DEFAULT_OPTIONS,
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 3600 * 24 * 7, // 7日間
    signed: true,
    encrypted: true
  }

  // CSRF用デフォルト設定
  private static readonly CSRF_OPTIONS: CookieOptions = {
    ...CookieManager.DEFAULT_OPTIONS,
    httpOnly: false, // JavaScriptからアクセス可能にする
    sameSite: 'strict',
    maxAge: 3600 * 24, // 24時間
    signed: true
  }

  /**
   * セキュアなCookieの設定
   */
  static set(
    response: NextResponse,
    name: string,
    value: string,
    options: CookieOptions = {}
  ): void {
    const opts = { ...this.DEFAULT_OPTIONS, ...options }
    
    // プレフィックスの追加（本番環境）
    if (process.env.NODE_ENV === 'production') {
      if (opts.secure && !opts.domain && opts.path === '/') {
        name = this.HOST_PREFIX + name
      } else if (opts.secure) {
        name = this.SECURE_PREFIX + name
      }
    }

    // 値の処理
    let processedValue = value

    // 暗号化
    if (opts.encrypted) {
      try {
        processedValue = this.encrypt(value)
      } catch (error) {
        logger.error('Cookie encryption failed', { name, error })
        return
      }
    }

    // 署名
    if (opts.signed) {
      processedValue = this.sign(processedValue)
    }

    // Cookieオプションの構築
    const cookieString = this.buildCookieString(name, processedValue, opts)
    
    // ヘッダーに追加
    response.headers.append('Set-Cookie', cookieString)
    
    logger.debug('Cookie set', { 
      name, 
      options: opts,
      secure: opts.secure,
      httpOnly: opts.httpOnly 
    })
  }

  /**
   * Cookieの取得
   */
  static get(
    request: NextRequest,
    name: string,
    options: {
      signed?: boolean
      encrypted?: boolean
    } = {}
  ): string | null {
    const opts = { 
      signed: this.DEFAULT_OPTIONS.signed,
      encrypted: false,
      ...options 
    }

    // プレフィックス付きで試行
    let value = request.cookies.get(this.HOST_PREFIX + name)?.value ||
                request.cookies.get(this.SECURE_PREFIX + name)?.value ||
                request.cookies.get(name)?.value

    if (!value) return null

    try {
      // 署名検証
      if (opts.signed) {
        value = this.verify(value)
        if (!value) {
          logger.warn('Cookie signature verification failed', { name })
          return null
        }
      }

      // 復号化
      if (opts.encrypted) {
        value = this.decrypt(value)
      }

      return value
    } catch (error) {
      logger.error('Cookie retrieval failed', { name, error })
      return null
    }
  }

  /**
   * Cookieの削除
   */
  static delete(
    response: NextResponse,
    name: string,
    options: Pick<CookieOptions, 'path' | 'domain'> = {}
  ): void {
    const opts = {
      path: '/',
      ...options,
      maxAge: 0,
      expires: new Date(0)
    }

    // プレフィックス付きも削除
    const names = [
      name,
      this.SECURE_PREFIX + name,
      this.HOST_PREFIX + name
    ]

    for (const cookieName of names) {
      const cookieString = this.buildCookieString(cookieName, '', opts)
      response.headers.append('Set-Cookie', cookieString)
    }

    logger.debug('Cookie deleted', { name })
  }

  /**
   * セッションCookieの設定
   */
  static setSession(
    response: NextResponse,
    sessionId: string,
    userId?: string
  ): void {
    // セッションID
    this.set(response, 'session', sessionId, this.SESSION_OPTIONS)
    
    // ユーザーID（オプション）
    if (userId) {
      this.set(response, 'uid', userId, {
        ...this.SESSION_OPTIONS,
        httpOnly: false // クライアント側で参照可能
      })
    }

    // CSRF トークン
    const csrfToken = CryptoUtils.generateCSRFToken()
    this.set(response, 'csrf-token', csrfToken, this.CSRF_OPTIONS)
    
    logger.info('Session cookies set', { sessionId, userId })
  }

  /**
   * セッションCookieの取得
   */
  static getSession(request: NextRequest): {
    sessionId: string | null
    userId: string | null
    csrfToken: string | null
  } {
    return {
      sessionId: this.get(request, 'session', { 
        signed: true, 
        encrypted: true 
      }),
      userId: this.get(request, 'uid', { 
        signed: true, 
        encrypted: true 
      }),
      csrfToken: this.get(request, 'csrf-token', { 
        signed: true 
      })
    }
  }

  /**
   * セッションCookieの削除
   */
  static clearSession(response: NextResponse): void {
    this.delete(response, 'session')
    this.delete(response, 'uid')
    this.delete(response, 'csrf-token')
    
    logger.info('Session cookies cleared')
  }

  /**
   * Cookie文字列の構築
   */
  private static buildCookieString(
    name: string,
    value: string,
    options: CookieOptions
  ): string {
    const parts = [`${name}=${encodeURIComponent(value)}`]

    if (options.maxAge !== undefined) {
      parts.push(`Max-Age=${options.maxAge}`)
    }

    if (options.expires) {
      parts.push(`Expires=${options.expires.toUTCString()}`)
    }

    if (options.domain) {
      parts.push(`Domain=${options.domain}`)
    }

    if (options.path) {
      parts.push(`Path=${options.path}`)
    }

    if (options.secure) {
      parts.push('Secure')
    }

    if (options.httpOnly) {
      parts.push('HttpOnly')
    }

    if (options.sameSite) {
      parts.push(`SameSite=${options.sameSite}`)
    }

    return parts.join('; ')
  }

  /**
   * 値の署名
   */
  private static sign(value: string): string {
    const secret = process.env.COOKIE_SECRET || 'default-secret-change-me'
    const signature = CryptoUtils.hmacSHA256(value, secret)
    return `${value}.${signature}`
  }

  /**
   * 署名の検証
   */
  private static verify(signedValue: string): string | null {
    const parts = signedValue.split('.')
    if (parts.length !== 2) return null

    const [value, signature] = parts
    const secret = process.env.COOKIE_SECRET || 'default-secret-change-me'
    const expectedSignature = CryptoUtils.hmacSHA256(value, secret)

    if (!CryptoUtils.timingSafeEqual(signature, expectedSignature)) {
      return null
    }

    return value
  }

  /**
   * 値の暗号化
   */
  private static encrypt(value: string): string {
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me'
    return CryptoUtils.encrypt(value, key)
  }

  /**
   * 値の復号化
   */
  private static decrypt(encryptedValue: string): string {
    const key = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-me'
    return CryptoUtils.decrypt(encryptedValue, key)
  }

  /**
   * SameSite属性の判定
   */
  static getSameSitePolicy(request: NextRequest): 'strict' | 'lax' | 'none' {
    const userAgent = request.headers.get('user-agent') || ''
    
    // 古いブラウザの検出
    const isOldBrowser = /Chrome\/5[0-9]|Chrome\/6[0-6]/.test(userAgent)
    
    if (isOldBrowser) {
      return 'lax' // 古いブラウザは'none'をサポートしない
    }
    
    // クロスオリジンリクエストの判定
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    
    if (origin && !origin.includes(host || '')) {
      return 'none' // クロスオリジンの場合
    }
    
    return 'strict' // 同一オリジンの場合
  }

  /**
   * セキュリティチェック
   */
  static validateCookieSecurity(request: NextRequest): {
    isSecure: boolean
    warnings: string[]
  } {
    const warnings: string[] = []
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const isSecure = protocol === 'https'

    if (!isSecure && process.env.NODE_ENV === 'production') {
      warnings.push('Cookies are being set over insecure connection')
    }

    // Cookieサイズチェック
    const cookies = request.cookies.getAll()
    let totalSize = 0
    
    for (const cookie of cookies) {
      const size = cookie.name.length + cookie.value.length
      totalSize += size
      
      if (size > 4096) {
        warnings.push(`Cookie ${cookie.name} exceeds 4KB limit`)
      }
    }
    
    if (totalSize > 4096 * 50) { // 50個分
      warnings.push('Total cookie size approaching browser limits')
    }

    if (warnings.length > 0) {
      logger.warn('Cookie security warnings', { warnings })
    }

    return { isSecure, warnings }
  }
}

/**
 * Cookieパーサーミドルウェア
 */
export function cookieParser() {
  return (req: NextRequest) => {
    // Cookieのセキュリティチェック
    CookieManager.validateCookieSecurity(req)
    
    // CSRFトークンの検証（POST, PUT, DELETE）
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const { csrfToken } = CookieManager.getSession(req)
      const headerToken = req.headers.get('x-csrf-token')
      
      if (!csrfToken || csrfToken !== headerToken) {
        logger.warn('CSRF token validation failed', {
          method: req.method,
          path: new URL(req.url).pathname
        })
        
        return NextResponse.json(
          { error: 'CSRF token validation failed' },
          { status: 403 }
        )
      }
    }
    
    return NextResponse.next()
  }
}