import { createHmac } from 'crypto'
import { logger } from '../utils/logger'

/**
 * APIキーのセキュリティ検証と保護
 */
export class ApiKeyValidator {
  private static readonly ALLOWED_DOMAINS = [
    'gasgenerator.onrender.com',
    'localhost:3000',
    'localhost:10000'
  ]
  
  /**
   * リクエスト元のドメイン検証
   */
  static validateOrigin(request: Request): boolean {
    const origin = request.headers.get('origin') || ''
    const referer = request.headers.get('referer') || ''
    
    // 本番環境では必須
    if (process.env.NODE_ENV === 'production') {
      const isValidOrigin = this.ALLOWED_DOMAINS.some(domain => 
        origin.includes(domain) || referer.includes(domain)
      )
      
      if (!isValidOrigin) {
        logger.warn('Invalid origin attempt', { origin, referer })
        return false
      }
    }
    
    return true
  }
  
  /**
   * LINE署名検証
   */
  static validateLineSignature(
    body: string,
    signature: string | null
  ): boolean {
    if (!signature) return false
    
    const channelSecret = process.env.LINE_CHANNEL_SECRET
    if (!channelSecret) {
      logger.error('LINE_CHANNEL_SECRET not configured')
      return false
    }
    
    const hash = createHmac('SHA256', channelSecret)
      .update(body)
      .digest('base64')
    
    return hash === signature
  }
  
  /**
   * APIキーの暗号化（保存時）
   */
  static encryptApiKey(apiKey: string): string {
    // 実装例：本番では強力な暗号化を使用
    const secret = process.env.ENCRYPTION_SECRET || 'default-secret-change-this'
    const cipher = createHmac('sha256', secret)
    return cipher.update(apiKey).digest('hex')
  }
  
  /**
   * APIキーのマスキング（ログ出力時）
   */
  static maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 10) return '***'
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
  }
  
  /**
   * 環境変数の存在確認（起動時）
   */
  static validateEnvironmentVariables(): void {
    const required = [
      'LINE_CHANNEL_ACCESS_TOKEN',
      'LINE_CHANNEL_SECRET',
      'ANTHROPIC_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ]
    
    const missing = required.filter(key => !process.env[key])
    
    if (missing.length > 0) {
      // 開発環境では警告、本番環境ではエラー
      if (process.env.NODE_ENV === 'production') {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
      } else {
        logger.warn('Missing environment variables', { missing })
      }
    }
    
    // APIキーの形式チェック
    this.validateApiKeyFormats()
  }
  
  /**
   * APIキーの形式検証
   */
  private static validateApiKeyFormats(): void {
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (anthropicKey && !anthropicKey.startsWith('sk-ant-')) {
      logger.warn('ANTHROPIC_API_KEY format may be invalid')
    }
    
    const supabaseUrl = process.env.SUPABASE_URL
    if (supabaseUrl && !supabaseUrl.includes('.supabase.co')) {
      logger.warn('SUPABASE_URL format may be invalid')
    }
  }
  
  /**
   * IPアドレス制限（オプション）
   */
  static validateIpAddress(request: Request): boolean {
    // CloudflareやRenderのIPヘッダーを確認
    const clientIp = 
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    
    // 必要に応じてIP制限を実装
    // const blockedIps = ['xxx.xxx.xxx.xxx']
    // if (blockedIps.includes(clientIp)) return false
    
    // レート制限用にIPを記録
    logger.debug('Request from IP', { ip: clientIp })
    
    return true
  }
  
  /**
   * リクエストの総合的なセキュリティチェック
   */
  static async validateRequest(
    request: Request,
    options: {
      checkOrigin?: boolean
      checkIp?: boolean
      checkSignature?: boolean
      body?: string
      signature?: string | null
    } = {}
  ): Promise<boolean> {
    // Origin検証
    if (options.checkOrigin && !this.validateOrigin(request)) {
      return false
    }
    
    // IP検証
    if (options.checkIp && !this.validateIpAddress(request)) {
      return false
    }
    
    // LINE署名検証
    if (options.checkSignature && options.body && options.signature) {
      if (!this.validateLineSignature(options.body, options.signature)) {
        logger.error('Invalid LINE signature')
        return false
      }
    }
    
    return true
  }
}

// アプリケーション起動時に実行
if (typeof window === 'undefined') {
  ApiKeyValidator.validateEnvironmentVariables()
}