/**
 * 暗号化ユーティリティ
 * セッションID生成、署名検証、暗号化処理
 */

import { createHmac, randomBytes } from 'crypto'
import { logger } from './logger'

export class CryptoUtils {
  /**
   * 暗号学的に安全なセッションIDを生成
   */
  static generateSessionId(): string {
    // 32バイトのランダムデータを生成（256ビット）
    const buffer = randomBytes(32)
    // Base64エンコード（URLセーフ）
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  /**
   * タイムスタンプ付きセッションIDを生成
   */
  static generateTimestampedSessionId(): string {
    const timestamp = Date.now().toString(36) // 36進数でコンパクトに
    const randomPart = this.generateSessionId()
    return `${timestamp}_${randomPart}`
  }

  /**
   * セッションIDのタイムスタンプを検証（タイミング攻撃対策）
   */
  static validateSessionIdAge(sessionId: string, maxAgeMs: number): boolean {
    // 固定時間処理を実装
    const startTime = Date.now()
    const MIN_PROCESSING_TIME = 10 // 最小処理時間（ミリ秒）
    
    let result = false
    
    try {
      const parts = sessionId.split('_')
      if (parts.length === 2) {
        const timestamp = parseInt(parts[0], 36)
        const age = Date.now() - timestamp
        result = age <= maxAgeMs
      }
    } catch {
      result = false
    }
    
    // タイミング攻撃対策：処理時間を一定にする
    const elapsedTime = Date.now() - startTime
    if (elapsedTime < MIN_PROCESSING_TIME) {
      const delay = MIN_PROCESSING_TIME - elapsedTime
      // 同期的な遅延（crypto.randomBytesを使って時間を消費）
      const buffer = randomBytes(delay * 100)
      buffer.toString('hex')
    }
    
    return result
  }

  /**
   * HMAC署名を生成
   */
  static generateHmacSignature(data: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(data)
      .digest('hex')
  }

  /**
   * HMAC署名を検証（タイミング攻撃対策付き）
   */
  static verifyHmacSignature(
    data: string,
    signature: string,
    secret: string
  ): boolean {
    const expectedSignature = this.generateHmacSignature(data, secret)
    return this.timingSafeEqual(signature, expectedSignature)
  }

  /**
   * タイミング攻撃対策の文字列比較
   */
  static timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    }
    
    return result === 0
  }

  /**
   * セッションIDのローテーション（固定化攻撃対策）
   */
  static rotateSessionId(oldSessionId: string): string {
    // 新しいセッションIDを生成
    const newSessionId = this.generateTimestampedSessionId()
    
    logger.info('Session ID rotated', {
      oldIdPrefix: oldSessionId.substring(0, 10),
      newIdPrefix: newSessionId.substring(0, 10)
    })
    
    return newSessionId
  }

  /**
   * CSRFトークンの生成
   */
  static generateCsrfToken(): string {
    return randomBytes(32).toString('hex')
  }

  /**
   * CSRFトークンの検証
   */
  static verifyCsrfToken(token: string, expectedToken: string): boolean {
    if (!token || !expectedToken) return false
    return this.timingSafeEqual(token, expectedToken)
  }

  /**
   * ワンタイムトークンの生成（有効期限付き）
   */
  static generateOneTimeToken(expiryMinutes: number = 5): {
    token: string
    expiry: Date
  } {
    const token = randomBytes(32).toString('hex')
    const expiry = new Date(Date.now() + expiryMinutes * 60 * 1000)
    
    return { token, expiry }
  }

  /**
   * セキュアなランダム文字列生成
   */
  static generateSecureRandomString(length: number = 32): string {
    const bytes = randomBytes(Math.ceil(length * 3 / 4))
    return bytes
      .toString('base64')
      .slice(0, length)
      .replace(/\+/g, '0')
      .replace(/\//g, '0')
  }

  /**
   * パスワードハッシュの生成（単純版、本番ではbcryptやargon2を使用）
   */
  static hashPassword(password: string, salt: string): string {
    return createHmac('sha256', salt)
      .update(password)
      .digest('hex')
  }

  /**
   * セッションフィンガープリントの生成
   */
  static generateSessionFingerprint(req: any): string {
    const components = [
      req.headers?.['user-agent'] || '',
      req.headers?.['accept-language'] || '',
      req.headers?.['accept-encoding'] || '',
      // IPアドレスは含めない（モバイル回線で変わるため）
    ]
    
    return createHmac('sha256', 'session-fingerprint')
      .update(components.join('|'))
      .digest('hex')
  }
}