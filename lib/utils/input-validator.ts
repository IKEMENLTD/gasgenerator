/**
 * 入力値検証ユーティリティ
 * SQLインジェクション、XSS、パストラバーサル攻撃を防ぐ
 */

import { logger } from './logger'

export class InputValidator {
  // SQLインジェクション危険パターン（ReDoS対策済み）
  private static readonly SQL_INJECTION_PATTERNS = [
    // キーワードチェック（単語境界で制限）
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE|ORDER BY|GROUP BY)\b/gi,
    // 危険な文字（シンプルパターン）
    /--|\/\*|\*\/|;|\\x00|\\n|\\r|\\t|\\x1a/g,
    // OR/AND攻撃（数値制限付き）
    /\bOR\s+\d{1,5}\s*=\s*\d{1,5}/gi,
    /\bAND\s+\d{1,5}\s*=\s*\d{1,5}/gi,
    // 文字列比較攻撃（長さ制限付き）
    /\bOR\b\s+'.{0,100}'\s*=\s*'.{0,100}'/gi,
  ]

  // XSS危険パターン（ReDoS対策済み）
  private static readonly XSS_PATTERNS = [
    // scriptタグ（非貪欲マッチング、長さ制限）
    /<script(?:\s[^>]{0,100})?>.{0,1000}<\/script>/gi,
    // iframeタグ（非貪欲マッチング、長さ制限）
    /<iframe(?:\s[^>]{0,100})?>.{0,1000}<\/iframe>/gi,
    // javascript:プロトコル
    /javascript:/gi,
    // イベントハンドラ（具体的なイベント名）
    /\b(onclick|onerror|onload|onmouseover|onfocus|onblur)\s*=/gi,
    // img src javascript（シンプル化）
    /<img[^>]*src\s*=\s*["']javascript:/gi,
  ]

  // パストラバーサル危険パターン
  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%252e%252e%252f/gi,
  ]

  // LINE User IDの正規表現パターン
  private static readonly LINE_USER_ID_PATTERN = /^U[0-9a-f]{32}$/

  // メールアドレスの正規表現パターン（ReDoS対策済み、長さ制限付き）
  private static readonly EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,63}\.[a-zA-Z]{2,10}$/

  /**
   * SQLインジェクション検証
   */
  static validateAgainstSQLInjection(input: string, fieldName: string = 'input'): boolean {
    if (!input) return true

    for (const pattern of this.SQL_INJECTION_PATTERNS) {
      if (pattern.test(input)) {
        logger.warn('SQL injection attempt detected', {
          fieldName,
          pattern: pattern.toString(),
          inputLength: input.length,
          // 入力値自体はログに記録しない（セキュリティのため）
        })
        return false
      }
    }
    return true
  }

  /**
   * XSS検証
   */
  static validateAgainstXSS(input: string, fieldName: string = 'input'): boolean {
    if (!input) return true

    for (const pattern of this.XSS_PATTERNS) {
      if (pattern.test(input)) {
        logger.warn('XSS attempt detected', {
          fieldName,
          pattern: pattern.toString(),
          inputLength: input.length,
        })
        return false
      }
    }
    return true
  }

  /**
   * パストラバーサル検証
   */
  static validateAgainstPathTraversal(input: string, fieldName: string = 'input'): boolean {
    if (!input) return true

    for (const pattern of this.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(input)) {
        logger.warn('Path traversal attempt detected', {
          fieldName,
          pattern: pattern.toString(),
          inputLength: input.length,
        })
        return false
      }
    }
    return true
  }

  /**
   * LINE User ID検証
   */
  static validateLineUserId(userId: string): boolean {
    if (!userId) return false
    
    // 長さチェック（U + 32文字の16進数）
    if (userId.length !== 33) return false
    
    // パターンチェック
    if (!this.LINE_USER_ID_PATTERN.test(userId)) {
      logger.warn('Invalid LINE User ID format', {
        length: userId.length,
        startsWithU: userId.startsWith('U'),
      })
      return false
    }

    // SQLインジェクション検証も実施
    return this.validateAgainstSQLInjection(userId, 'lineUserId')
  }

  /**
   * メールアドレス検証
   */
  static validateEmail(email: string): boolean {
    if (!email) return false
    
    // 長さチェック
    if (email.length > 254) return false
    
    // パターンチェック
    if (!this.EMAIL_PATTERN.test(email)) {
      logger.warn('Invalid email format', {
        length: email.length,
      })
      return false
    }

    // SQLインジェクション検証も実施
    return this.validateAgainstSQLInjection(email, 'email')
  }

  /**
   * 文字列長検証
   */
  static validateLength(
    input: string,
    minLength: number,
    maxLength: number,
    fieldName: string = 'input'
  ): boolean {
    if (!input) {
      return minLength === 0
    }

    const length = input.length
    if (length < minLength || length > maxLength) {
      logger.warn('Invalid input length', {
        fieldName,
        length,
        minLength,
        maxLength,
      })
      return false
    }

    return true
  }

  /**
   * 数値範囲検証
   */
  static validateNumberRange(
    value: number,
    min: number,
    max: number,
    fieldName: string = 'value'
  ): boolean {
    if (typeof value !== 'number' || isNaN(value)) {
      logger.warn('Invalid number', { fieldName })
      return false
    }

    if (value < min || value > max) {
      logger.warn('Number out of range', {
        fieldName,
        value,
        min,
        max,
      })
      return false
    }

    return true
  }

  /**
   * 複合検証（すべての攻撃パターンをチェック）
   */
  static validateInput(input: string, fieldName: string = 'input'): boolean {
    if (!input) return true

    // すべての検証を実施
    const validations = [
      this.validateAgainstSQLInjection(input, fieldName),
      this.validateAgainstXSS(input, fieldName),
      this.validateAgainstPathTraversal(input, fieldName),
      this.validateLength(input, 0, 10000, fieldName), // 最大10KB
    ]

    return validations.every(v => v)
  }

  /**
   * サニタイズ（エスケープ処理）
   */
  static sanitize(input: string): string {
    if (!input) return ''

    // HTMLエスケープ
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  /**
   * Supabaseクエリ用のサニタイズ
   */
  static sanitizeForSupabase(input: string): string {
    if (!input) return ''

    // Supabaseのクエリで危険な文字をエスケープ
    return input
      .replace(/'/g, "''") // シングルクォートをエスケープ
      .replace(/;/g, '') // セミコロンを削除
      .replace(/--/g, '') // SQLコメントを削除
      .replace(/\/\*/g, '') // SQLコメントを削除
      .replace(/\*\//g, '') // SQLコメントを削除
  }

  /**
   * JSONパース検証
   */
  static validateJSON(jsonString: string): boolean {
    try {
      JSON.parse(jsonString)
      return true
    } catch {
      logger.warn('Invalid JSON format')
      return false
    }
  }

  /**
   * URL検証
   */
  static validateURL(url: string): boolean {
    try {
      const urlObj = new URL(url)
      // HTTPSのみ許可（セキュリティのため）
      if (urlObj.protocol !== 'https:') {
        logger.warn('Non-HTTPS URL detected', { protocol: urlObj.protocol })
        return false
      }
      return true
    } catch {
      logger.warn('Invalid URL format')
      return false
    }
  }
}