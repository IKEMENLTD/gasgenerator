/**
 * URL検証ユーティリティ
 * オープンリダイレクト攻撃を防ぐための検証
 */

import { logger } from './logger'

export class URLValidator {
  // 許可されたドメインのリスト
  private static readonly ALLOWED_DOMAINS = [
    'gasgenerator.onrender.com',
    'localhost:3000',
    'localhost:3001',
    '127.0.0.1:3000'
  ]

  // 許可されたプロトコル
  private static readonly ALLOWED_PROTOCOLS = ['http:', 'https:']

  // 危険なURLパターン
  private static readonly DANGEROUS_PATTERNS = [
    /javascript:/i,
    /data:/i,
    /vbscript:/i,
    /file:/i,
    /about:/i,
    /chrome:/i,
    /<script/i,
    /%3Cscript/i,
    /onclick=/i,
    /onerror=/i
  ]

  /**
   * URLの検証
   */
  static isValidRedirectURL(url: string, options: {
    allowExternal?: boolean
    allowedDomains?: string[]
    baseDomain?: string
  } = {}): boolean {
    const {
      allowExternal = false,
      allowedDomains = this.ALLOWED_DOMAINS,
      baseDomain
    } = options

    try {
      // 相対URLの処理
      if (url.startsWith('/')) {
        // 相対URLは常に許可（ただしパストラバーサルをチェック）
        return !this.hasPathTraversal(url)
      }

      // 絶対URLの検証
      const parsed = new URL(url)

      // プロトコルの検証
      if (!this.ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        logger.warn('Invalid protocol in redirect URL', { url, protocol: parsed.protocol })
        return false
      }

      // 危険なパターンの検出
      if (this.DANGEROUS_PATTERNS.some(pattern => pattern.test(url))) {
        logger.warn('Dangerous pattern detected in URL', { url })
        return false
      }

      // 外部URLが許可されていない場合
      if (!allowExternal) {
        const hostname = parsed.hostname.toLowerCase()
        
        // baseDomainが指定されている場合
        if (baseDomain) {
          if (!hostname.endsWith(baseDomain) && hostname !== baseDomain.replace('www.', '')) {
            logger.warn('External redirect blocked', { url, hostname, baseDomain })
            return false
          }
        } else {
          // 許可リストチェック
          const isAllowed = allowedDomains.some(domain => {
            const normalizedDomain = domain.toLowerCase()
            return hostname === normalizedDomain || 
                   hostname === `www.${normalizedDomain}` ||
                   hostname.endsWith(`.${normalizedDomain}`)
          })

          if (!isAllowed) {
            logger.warn('Domain not in allowlist', { url, hostname, allowedDomains })
            return false
          }
        }
      }

      // ユーザー情報が含まれていないことを確認
      if (parsed.username || parsed.password) {
        logger.warn('URL contains credentials', { url })
        return false
      }

      return true
    } catch (error) {
      logger.error('Invalid URL format', { url, error })
      return false
    }
  }

  /**
   * パストラバーサルの検出
   */
  private static hasPathTraversal(path: string): boolean {
    const dangerous = [
      '../',
      '..\\',
      '%2e%2e%2f',
      '%2e%2e/',
      '..%2f',
      '%2e%2e%5c',
      '..%5c',
      '%252e%252e%252f',
      '..%252f',
      '..;/',
      '..;\\',
      '..//',
      '..\\\\',
      '.././',
      '..\\.\\'
    ]

    const lowerPath = path.toLowerCase()
    return dangerous.some(pattern => lowerPath.includes(pattern))
  }

  /**
   * 安全なリダイレクトURL生成
   */
  static createSafeRedirectURL(
    path: string,
    baseURL?: string
  ): string {
    // パスの正規化
    const cleanPath = path
      .replace(/\/+/g, '/') // 連続するスラッシュを単一に
      .replace(/^([^/])/, '/$1') // 先頭にスラッシュを追加

    // パストラバーサルチェック
    if (this.hasPathTraversal(cleanPath)) {
      logger.warn('Path traversal attempt blocked', { originalPath: path })
      return '/'
    }

    // ベースURLが指定されている場合
    if (baseURL) {
      try {
        const base = new URL(baseURL)
        return new URL(cleanPath, base).toString()
      } catch {
        return cleanPath
      }
    }

    return cleanPath
  }

  /**
   * URLのサニタイズ
   */
  static sanitizeURL(url: string): string {
    try {
      const parsed = new URL(url)
      
      // クエリパラメータのサニタイズ
      const sanitizedParams = new URLSearchParams()
      for (const [key, value] of parsed.searchParams) {
        // XSS危険文字を除去
        const cleanKey = key.replace(/[<>'"]/g, '')
        const cleanValue = value.replace(/[<>'"]/g, '')
        sanitizedParams.append(cleanKey, cleanValue)
      }
      
      parsed.search = sanitizedParams.toString()
      
      // フラグメントのサニタイズ
      parsed.hash = parsed.hash.replace(/[<>'"]/g, '')
      
      return parsed.toString()
    } catch {
      // 無効なURLの場合はルートにリダイレクト
      return '/'
    }
  }

  /**
   * ホワイトリストベースのリダイレクト
   */
  static getWhitelistedRedirect(
    requestedURL: string,
    whitelist: Record<string, string>
  ): string | null {
    // 完全一致
    if (whitelist[requestedURL]) {
      return whitelist[requestedURL]
    }

    // パスのみでマッチ
    try {
      const parsed = new URL(requestedURL, 'http://example.com')
      const path = parsed.pathname
      
      if (whitelist[path]) {
        return whitelist[path]
      }
    } catch {
      // 無視
    }

    return null
  }

  /**
   * リファラーの検証
   */
  static validateReferer(
    referer: string | null,
    expectedDomain: string
  ): boolean {
    if (!referer) return false

    try {
      const parsed = new URL(referer)
      return parsed.hostname === expectedDomain ||
             parsed.hostname.endsWith(`.${expectedDomain}`)
    } catch {
      return false
    }
  }

  /**
   * SSRF攻撃の防止
   */
  static isSSRFSafe(url: string): boolean {
    try {
      const parsed = new URL(url)
      
      // ローカルIPアドレスのブロック
      const hostname = parsed.hostname.toLowerCase()
      
      // IPv4ローカルアドレス
      const localIPv4Patterns = [
        /^127\./,
        /^10\./,
        /^172\.(1[6-9]|2[0-9]|3[01])\./,
        /^192\.168\./,
        /^169\.254\./ // Link-local
      ]
      
      if (localIPv4Patterns.some(pattern => pattern.test(hostname))) {
        logger.warn('SSRF attempt blocked - local IP', { url, hostname })
        return false
      }

      // ローカルホスト名
      const localHostnames = [
        'localhost',
        'local',
        '0.0.0.0',
        '[::1]',
        '[::ffff:127.0.0.1]'
      ]
      
      if (localHostnames.includes(hostname)) {
        logger.warn('SSRF attempt blocked - localhost', { url, hostname })
        return false
      }

      // クラウドメタデータエンドポイント
      const metadataEndpoints = [
        '169.254.169.254', // AWS
        'metadata.google.internal', // GCP
        'metadata.azure.com' // Azure
      ]
      
      if (metadataEndpoints.includes(hostname)) {
        logger.warn('SSRF attempt blocked - metadata endpoint', { url, hostname })
        return false
      }

      // 非標準ポート（一般的なサービスポート以外）
      const allowedPorts = [80, 443, 8080, 8443]
      const port = parsed.port ? parseInt(parsed.port) : 
                  (parsed.protocol === 'https:' ? 443 : 80)
      
      if (!allowedPorts.includes(port)) {
        logger.warn('SSRF attempt blocked - non-standard port', { url, port })
        return false
      }

      return true
    } catch (error) {
      logger.error('Invalid URL for SSRF check', { url, error })
      return false
    }
  }
}