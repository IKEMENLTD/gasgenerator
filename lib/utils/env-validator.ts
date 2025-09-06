/**
 * 環境変数バリデーション
 */

interface RequiredEnvVars {
  // LINE関連
  LINE_CHANNEL_ACCESS_TOKEN: string
  LINE_CHANNEL_SECRET: string
  
  // Supabase関連
  NEXT_PUBLIC_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  
  // Claude AI関連
  ANTHROPIC_API_KEY: string
  
  // Stripe関連（オプション）
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
}

class EnvValidator {
  private static instance: EnvValidator
  private validated = false
  private errors: string[] = []

  private constructor() {}

  static getInstance(): EnvValidator {
    if (!EnvValidator.instance) {
      EnvValidator.instance = new EnvValidator()
    }
    return EnvValidator.instance
  }

  /**
   * 必須環境変数をチェック
   */
  validateRequired(): { isValid: boolean; errors: string[] } {
    if (this.validated) {
      return { isValid: this.errors.length === 0, errors: this.errors }
    }

    this.errors = []

    // 必須環境変数のチェック
    const required = [
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_CHANNEL_SECRET',
      'NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ANTHROPIC_API_KEY'
    ]

    for (const key of required) {
      if (!process.env[key]) {
        this.errors.push(`Missing required environment variable: ${key}`)
      }
    }

    // Supabase URLの形式チェック
    if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
      try {
        new URL(process.env.NEXT_PUBLIC_SUPABASE_URL)
      } catch {
        this.errors.push('Invalid NEXT_PUBLIC_SUPABASE_URL format')
      }
    }

    // LINE Channel Secretの長さチェック
    if (process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_SECRET.length !== 32) {
      this.errors.push('LINE_CHANNEL_SECRET must be 32 characters')
    }

    this.validated = true
    return { isValid: this.errors.length === 0, errors: this.errors }
  }

  /**
   * Stripe環境変数をチェック（決済機能使用時）
   */
  validateStripe(): { isValid: boolean; errors: string[] } {
    const stripeErrors: string[] = []

    if (!process.env.STRIPE_SECRET_KEY) {
      stripeErrors.push('Missing STRIPE_SECRET_KEY for payment processing')
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      stripeErrors.push('Missing STRIPE_WEBHOOK_SECRET for webhook verification')
    }

    return { isValid: stripeErrors.length === 0, errors: stripeErrors }
  }

  /**
   * 環境変数の値を安全に取得
   */
  static get(key: keyof RequiredEnvVars): string {
    const value = process.env[key]
    if (!value && !key.includes('STRIPE')) {
      throw new Error(`Environment variable ${key} is not set`)
    }
    return value || ''
  }

  /**
   * 環境変数の存在確認
   */
  static has(key: keyof RequiredEnvVars): boolean {
    return !!process.env[key]
  }
}

// 起動時に自動検証
const validator = EnvValidator.getInstance()
const validation = validator.validateRequired()

if (!validation.isValid) {
  console.error('❌ Environment validation failed:')
  validation.errors.forEach(error => console.error(`  - ${error}`))
  
  // 開発環境では警告のみ、本番環境ではエラー
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Missing required environment variables')
  }
}

export { EnvValidator }
export default EnvValidator.getInstance()