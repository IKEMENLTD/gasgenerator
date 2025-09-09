/**
 * JWT認証管理
 * 管理者APIアクセス用のJWTトークン生成・検証
 */

import { createHmac } from 'crypto'
import { logger } from '@/lib/utils/logger'
import EnvironmentValidator from '@/lib/config/environment'

interface JWTPayload {
  sub: string // Subject (user ID)
  iat: number // Issued at
  exp: number // Expiration
  role: 'admin' | 'user'
  jti?: string // JWT ID (for revocation)
}

export class JWTManager {
  private static readonly ALGORITHM = 'HS256'
  private static readonly TOKEN_EXPIRY = 3600 // 1時間
  private static readonly REFRESH_TOKEN_EXPIRY = 86400 * 7 // 7日間
  
  // 失効したトークンIDのセット（実際の実装ではRedisを使用すべき）
  private static revokedTokens = new Set<string>()
  
  /**
   * JWTトークンを生成
   */
  static generateToken(userId: string, role: 'admin' | 'user' = 'user'): {
    token: string
    expiresAt: Date
  } {
    const secret = EnvironmentValidator.getRequired('ADMIN_API_TOKEN')
    
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + this.TOKEN_EXPIRY
    
    const payload: JWTPayload = {
      sub: userId,
      iat: now,
      exp: expiresAt,
      role,
      jti: this.generateTokenId()
    }
    
    // Header
    const header = {
      alg: this.ALGORITHM,
      typ: 'JWT'
    }
    
    // Encode header and payload
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header))
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload))
    
    // Create signature
    const message = `${encodedHeader}.${encodedPayload}`
    const signature = this.createSignature(message, secret)
    
    // Combine to create JWT
    const token = `${message}.${signature}`
    
    logger.info('JWT token generated', {
      userId,
      role,
      expiresAt: new Date(expiresAt * 1000).toISOString()
    })
    
    return {
      token,
      expiresAt: new Date(expiresAt * 1000)
    }
  }
  
  /**
   * JWTトークンを検証
   */
  static verifyToken(token: string): {
    valid: boolean
    payload?: JWTPayload
    error?: string
  } {
    try {
      const secret = EnvironmentValidator.getRequired('ADMIN_API_TOKEN')
      
      // Split token
      const parts = token.split('.')
      if (parts.length !== 3) {
        return { valid: false, error: 'Invalid token format' }
      }
      
      const [encodedHeader, encodedPayload, signature] = parts
      
      // Verify signature
      const message = `${encodedHeader}.${encodedPayload}`
      const expectedSignature = this.createSignature(message, secret)
      
      if (!this.timingSafeEqual(signature, expectedSignature)) {
        logger.warn('Invalid JWT signature')
        return { valid: false, error: 'Invalid signature' }
      }
      
      // Decode and verify payload
      const payload = JSON.parse(this.base64UrlDecode(encodedPayload)) as JWTPayload
      
      // Check expiration
      const now = Math.floor(Date.now() / 1000)
      if (payload.exp && payload.exp < now) {
        return { valid: false, error: 'Token expired' }
      }
      
      // Check if token is revoked
      if (payload.jti && this.revokedTokens.has(payload.jti)) {
        return { valid: false, error: 'Token revoked' }
      }
      
      // Check issued at time (prevent future tokens)
      if (payload.iat > now + 60) { // 1分の余裕を持たせる
        return { valid: false, error: 'Token issued in the future' }
      }
      
      return { valid: true, payload }
      
    } catch (error) {
      logger.error('JWT verification error', { error })
      return { valid: false, error: 'Verification failed' }
    }
  }
  
  /**
   * トークンを失効させる
   */
  static revokeToken(tokenId: string): void {
    this.revokedTokens.add(tokenId)
    
    // 期限切れのトークンIDを定期的にクリーンアップ
    if (this.revokedTokens.size > 1000) {
      this.cleanupRevokedTokens()
    }
  }
  
  /**
   * リフレッシュトークンを生成
   */
  static generateRefreshToken(userId: string): {
    refreshToken: string
    expiresAt: Date
  } {
    const secret = EnvironmentValidator.getRequired('ADMIN_API_TOKEN')
    
    const now = Math.floor(Date.now() / 1000)
    const expiresAt = now + this.REFRESH_TOKEN_EXPIRY
    
    const payload = {
      sub: userId,
      iat: now,
      exp: expiresAt,
      type: 'refresh'
    }
    
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload))
    const signature = this.createSignature(encodedPayload, secret + '_refresh')
    
    return {
      refreshToken: `${encodedPayload}.${signature}`,
      expiresAt: new Date(expiresAt * 1000)
    }
  }
  
  /**
   * Base64 URL エンコード
   */
  private static base64UrlEncode(str: string): string {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
  
  /**
   * Base64 URL デコード
   */
  private static base64UrlDecode(str: string): string {
    // パディングを復元
    const padding = 4 - (str.length % 4)
    if (padding !== 4) {
      str += '='.repeat(padding)
    }
    
    // URLセーフ文字を元に戻す
    str = str.replace(/-/g, '+').replace(/_/g, '/')
    
    return Buffer.from(str, 'base64').toString('utf-8')
  }
  
  /**
   * HMAC署名を作成
   */
  private static createSignature(message: string, secret: string): string {
    const hmac = createHmac('sha256', secret)
    hmac.update(message)
    return hmac.digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }
  
  /**
   * タイミング攻撃対策の文字列比較
   */
  private static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    
    return result === 0
  }
  
  /**
   * トークンIDを生成
   */
  private static generateTokenId(): string {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(16)))
      .toString('hex')
  }
  
  /**
   * 失効トークンのクリーンアップ
   */
  private static cleanupRevokedTokens(): void {
    // 実際の実装ではRedisのTTLを使用
    // ここでは簡易的に最大サイズを維持
    if (this.revokedTokens.size > 500) {
      const tokens = Array.from(this.revokedTokens)
      this.revokedTokens = new Set(tokens.slice(-500))
    }
  }
  
  /**
   * 管理者権限を検証
   */
  static requireAdmin(token: string): boolean {
    const result = this.verifyToken(token)
    return result.valid && result.payload?.role === 'admin'
  }
}