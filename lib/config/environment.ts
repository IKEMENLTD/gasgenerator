/**
 * 環境変数の検証と管理
 */

import { logger } from '@/lib/utils/logger'

// 必須環境変数の定義
const REQUIRED_ENV_VARS = {
  // LINE
  LINE_CHANNEL_ACCESS_TOKEN: 'LINE Bot APIアクセストークン',
  LINE_CHANNEL_SECRET: 'LINE署名検証用シークレット',
  
  // Stripe
  STRIPE_SECRET_KEY: 'Stripe APIキー',
  STRIPE_WEBHOOK_SECRET: 'Stripe Webhook署名検証用シークレット',
  STRIPE_PAYMENT_LINK: 'Stripe決済リンク',
  
  // Supabase
  SUPABASE_URL: 'SupabaseプロジェクトURL',
  SUPABASE_ANON_KEY: 'Supabase匿名キー',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabaseサービスロールキー',
  
  // Claude AI
  ANTHROPIC_API_KEY: 'Claude API キー',
  
  // Security
  CRON_SECRET: 'Cronジョブ認証用シークレット',
} as const

// オプション環境変数の定義
const OPTIONAL_ENV_VARS = {
  // Security
  ADMIN_API_TOKEN: '管理API認証トークン',
  
  // Engineer Support
  ENGINEER_SUPPORT_GROUP_ID: 'エンジニアサポートグループID',
  ENGINEER_USER_IDS: 'エンジニアユーザーID（カンマ区切り）',
  
  // Config
  NODE_ENV: '実行環境（development/production）',
  NEXT_PUBLIC_BASE_URL: 'アプリケーションベースURL',
  PORT: 'サーバーポート番号',
} as const

export class EnvironmentValidator {
  private static validated = false
  private static errors: string[] = []
  private static warnings: string[] = []
  
  /**
   * 環境変数を検証
   */
  static validate(): { valid: boolean; errors: string[]; warnings: string[] } {
    if (this.validated) {
      return { 
        valid: this.errors.length === 0, 
        errors: this.errors, 
        warnings: this.warnings 
      }
    }
    
    this.errors = []
    this.warnings = []
    
    // 必須環境変数のチェック
    for (const [key, description] of Object.entries(REQUIRED_ENV_VARS)) {
      if (!process.env[key]) {
        this.errors.push(`必須環境変数 ${key} が設定されていません: ${description}`)
      } else if (process.env[key]!.trim() === '') {
        this.errors.push(`必須環境変数 ${key} が空です: ${description}`)
      }
    }
    
    // オプション環境変数のチェック
    for (const [key, description] of Object.entries(OPTIONAL_ENV_VARS)) {
      if (!process.env[key]) {
        this.warnings.push(`オプション環境変数 ${key} が未設定: ${description}`)
      }
    }
    
    // 特別な検証
    this.validateSpecialCases()
    
    this.validated = true
    
    // ログ出力
    if (this.errors.length > 0) {
      logger.error('環境変数の検証エラー', { errors: this.errors })
    }
    if (this.warnings.length > 0) {
      logger.warn('環境変数の警告', { warnings: this.warnings })
    }
    
    return { 
      valid: this.errors.length === 0, 
      errors: this.errors, 
      warnings: this.warnings 
    }
  }
  
  /**
   * 特別なケースの検証
   */
  private static validateSpecialCases(): void {
    // NODE_ENV のチェック
    const nodeEnv = process.env.NODE_ENV
    if (nodeEnv && !['development', 'test', 'production'].includes(nodeEnv)) {
      this.warnings.push(`NODE_ENV の値が不正です: ${nodeEnv}`)
    }
    
    // Supabase URLの形式チェック
    const supabaseUrl = process.env.SUPABASE_URL
    if (supabaseUrl && !supabaseUrl.includes('.supabase.co')) {
      this.warnings.push('SUPABASE_URL が正しいSupabase URLではない可能性があります')
    }
    
    // Stripe キーのプレフィックスチェック
    const stripeKey = process.env.STRIPE_SECRET_KEY
    if (stripeKey) {
      if (stripeKey.startsWith('pk_')) {
        this.errors.push('STRIPE_SECRET_KEY に公開キーが設定されています（sk_で始まる秘密キーを使用してください）')
      } else if (!stripeKey.startsWith('sk_')) {
        this.warnings.push('STRIPE_SECRET_KEY が正しい形式ではない可能性があります')
      }
    }
    
    // LINE Channel Secretの長さチェック
    const lineSecret = process.env.LINE_CHANNEL_SECRET
    if (lineSecret && lineSecret.length !== 32) {
      this.warnings.push('LINE_CHANNEL_SECRET の長さが正しくない可能性があります（32文字である必要があります）')
    }
    
    // ポート番号の検証
    const port = process.env.PORT
    if (port) {
      const portNum = parseInt(port, 10)
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        this.errors.push(`PORT の値が不正です: ${port}`)
      }
    }
  }
  
  /**
   * 環境変数を安全に取得
   */
  static get(key: string): string | undefined {
    const value = process.env[key]
    if (!value && key in REQUIRED_ENV_VARS) {
      logger.error(`必須環境変数 ${key} が取得できません`)
    }
    return value
  }
  
  /**
   * 環境変数を取得（必須）
   */
  static getRequired(key: keyof typeof REQUIRED_ENV_VARS): string {
    const value = process.env[key]
    if (!value) {
      const error = `必須環境変数 ${key} が設定されていません`
      logger.error(error)
      throw new Error(error)
    }
    return value
  }
  
  /**
   * 環境変数を取得（オプション、デフォルト値付き）
   */
  static getOptional(key: string, defaultValue: string): string {
    return process.env[key] || defaultValue
  }
  
  /**
   * 開発環境かどうか
   */
  static isDevelopment(): boolean {
    return process.env.NODE_ENV === 'development'
  }
  
  /**
   * 本番環境かどうか
   */
  static isProduction(): boolean {
    return process.env.NODE_ENV === 'production'
  }
  
  /**
   * テスト環境かどうか
   */
  static isTest(): boolean {
    return process.env.NODE_ENV === 'test'
  }
}

// アプリケーション起動時に自動検証
if (typeof window === 'undefined') {
  // サーバーサイドでのみ実行
  const validation = EnvironmentValidator.validate()
  
  if (!validation.valid) {
    console.error('='.repeat(60))
    console.error('環境変数の設定エラー')
    console.error('='.repeat(60))
    validation.errors.forEach(error => console.error(`❌ ${error}`))
    console.error('='.repeat(60))
    console.error('アプリケーションを起動できません。.env.local ファイルを確認してください。')
    console.error('='.repeat(60))
    
    // 本番環境では起動を停止（Edge Runtimeでは使用不可）
    if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
      if (typeof process.exit === 'function') {
        process.exit(1)
      }
      throw new Error('環境変数の設定エラー')
    }
  }
  
  if (validation.warnings.length > 0) {
    console.warn('='.repeat(60))
    console.warn('環境変数の警告')
    console.warn('='.repeat(60))
    validation.warnings.forEach(warning => console.warn(`⚠️ ${warning}`))
    console.warn('='.repeat(60))
  }
}

export default EnvironmentValidator