import * as crypto from 'crypto'

/**
 * セキュアなランダム値生成ユーティリティ
 */
export class SecureRandom {
  /**
   * セキュアなランダムID生成
   */
  static generateId(prefix: string = ''): string {
    const randomBytes = crypto.randomBytes(16)
    const hex = randomBytes.toString('hex')
    const timestamp = Date.now().toString(36)
    return prefix ? `${prefix}_${timestamp}_${hex}` : `${timestamp}_${hex}`
  }

  /**
   * セキュアなランダム文字列生成
   */
  static generateString(length: number = 32): string {
    const bytes = crypto.randomBytes(Math.ceil(length / 2))
    return bytes.toString('hex').slice(0, length)
  }

  /**
   * セキュアなランダム数値生成（0-1の範囲）
   */
  static random(): number {
    const bytes = crypto.randomBytes(4)
    const value = bytes.readUInt32BE(0)
    return value / 0xFFFFFFFF
  }

  /**
   * セキュアなランダム整数生成（min-maxの範囲）
   */
  static randomInt(min: number, max: number): number {
    const range = max - min + 1
    const bytes = crypto.randomBytes(4)
    const value = bytes.readUInt32BE(0)
    return min + (value % range)
  }

  /**
   * UUID v4生成
   */
  static generateUUID(): string {
    return crypto.randomUUID()
  }

  /**
   * セキュアなトークン生成
   */
  static generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url')
  }
}