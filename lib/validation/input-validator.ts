import { AppError } from '@/lib/errors/app-error'

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'json'
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  min?: number
  max?: number
  enum?: any[]
  custom?: (value: any) => boolean | string
}

export interface ValidationSchema {
  [field: string]: ValidationRule
}

export class InputValidator {
  // 危険な文字列パターンの検出
  private static readonly DANGEROUS_PATTERNS = [
    /(\bDROP\s+TABLE\b|\bDELETE\s+FROM\b|\bUPDATE\s+.*\bSET\b)/gi, // SQL injection
    /<script[^>]*>.*?<\/script>/gi, // XSS
    /javascript:/gi, // JavaScript protocol
    /on\w+\s*=/gi, // Event handlers
    /\.\.[\/\\]/g, // Path traversal
    /[;&|`$]/g, // Command injection characters
  ]

  // LINEユーザーIDの形式
  private static readonly LINE_USER_ID_PATTERN = /^U[0-9a-f]{32}$/

  // UUIDの形式
  private static readonly UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

  /**
   * 入力値の検証
   */
  static validate(data: any, schema: ValidationSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    for (const [field, rule] of Object.entries(schema)) {
      const value = data[field]

      // 必須チェック
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`)
        continue
      }

      // 値がない場合はスキップ
      if (value === undefined || value === null) continue

      // 型チェック
      const typeError = this.validateType(value, rule, field)
      if (typeError) {
        errors.push(typeError)
        continue
      }

      // 詳細な検証
      const detailErrors = this.validateDetails(value, rule, field)
      errors.push(...detailErrors)
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * 型の検証
   */
  private static validateType(value: any, rule: ValidationRule, field: string): string | null {
    switch (rule.type) {
      case 'string':
        if (typeof value !== 'string') {
          return `${field} must be a string`
        }
        break
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return `${field} must be a number`
        }
        break
      case 'boolean':
        if (typeof value !== 'boolean') {
          return `${field} must be a boolean`
        }
        break
      case 'email':
        if (!this.isValidEmail(value)) {
          return `${field} must be a valid email`
        }
        break
      case 'url':
        if (!this.isValidUrl(value)) {
          return `${field} must be a valid URL`
        }
        break
      case 'uuid':
        if (!this.UUID_PATTERN.test(value)) {
          return `${field} must be a valid UUID`
        }
        break
      case 'json':
        try {
          JSON.parse(value)
        } catch {
          return `${field} must be valid JSON`
        }
        break
    }
    return null
  }

  /**
   * 詳細な検証
   */
  private static validateDetails(value: any, rule: ValidationRule, field: string): string[] {
    const errors: string[] = []

    // 文字列の長さ
    if (typeof value === 'string') {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${field} must be at least ${rule.minLength} characters`)
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field} must be at most ${rule.maxLength} characters`)
      }
      
      // 危険なパターンの検出
      for (const pattern of this.DANGEROUS_PATTERNS) {
        if (pattern.test(value)) {
          errors.push(`${field} contains potentially dangerous content`)
          break
        }
      }
    }

    // 数値の範囲
    if (typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${field} must be at least ${rule.min}`)
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${field} must be at most ${rule.max}`)
      }
    }

    // パターンマッチ
    if (rule.pattern && !rule.pattern.test(String(value))) {
      errors.push(`${field} does not match required pattern`)
    }

    // 列挙値
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${field} must be one of: ${rule.enum.join(', ')}`)
    }

    // カスタム検証
    if (rule.custom) {
      const result = rule.custom(value)
      if (result !== true) {
        errors.push(typeof result === 'string' ? result : `${field} failed custom validation`)
      }
    }

    return errors
  }

  /**
   * メールアドレスの検証
   */
  private static isValidEmail(email: string): boolean {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return pattern.test(email)
  }

  /**
   * URLの検証
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * LINEユーザーIDの検証
   */
  static validateLineUserId(userId: string): boolean {
    return this.LINE_USER_ID_PATTERN.test(userId)
  }

  /**
   * サニタイズ（危険な文字の除去）
   */
  static sanitize(input: string): string {
    let sanitized = input

    // HTMLエスケープ
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')

    // 制御文字の除去
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

    return sanitized
  }

  /**
   * Webhookリクエストの検証スキーマ
   */
  static readonly WEBHOOK_SCHEMA: ValidationSchema = {
    events: {
      type: 'json',
      required: true
    }
  }

  /**
   * コード生成リクエストの検証スキーマ
   */
  static readonly CODE_GENERATION_SCHEMA: ValidationSchema = {
    userId: {
      type: 'string',
      required: true,
      pattern: /^U[0-9a-f]{32}$/,
      custom: (value) => {
        if (value.length !== 33) return 'Invalid LINE user ID format'
        return true
      }
    },
    category: {
      type: 'string',
      required: true,
      enum: ['gmail', 'calendar', 'sheets', 'drive', 'other'],
      maxLength: 50
    },
    requirements: {
      type: 'json',
      required: true,
      maxLength: 10000
    },
    sessionId: {
      type: 'uuid',
      required: false
    }
  }

  /**
   * APIキーの検証
   */
  static validateApiKey(key: string, type: 'anthropic' | 'line'): boolean {
    switch (type) {
      case 'anthropic':
        return key.startsWith('sk-ant-') && key.length > 40
      case 'line':
        return key.length > 20
      default:
        return false
    }
  }
}