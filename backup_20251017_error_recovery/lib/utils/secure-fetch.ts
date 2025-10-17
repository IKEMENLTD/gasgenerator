/**
 * セキュアなHTTPリクエストユーティリティ
 * SSRF攻撃を防ぐための安全なfetchラッパー
 */

import { logger } from './logger'
import { URLValidator } from './url-validator'
import { RetryHandler } from './retry-handler'

export interface SecureFetchOptions extends RequestInit {
  maxRedirects?: number
  timeout?: number
  allowPrivateIPs?: boolean
  allowedDomains?: string[]
  retryOptions?: {
    maxAttempts?: number
    retryableStatusCodes?: number[]
  }
}

export class SecureFetch {
  private static readonly DEFAULT_TIMEOUT = 30000 // 30秒
  private static readonly MAX_REDIRECTS = 5
  private static readonly BLOCKED_PORTS = [
    22, 23, 25, 110, 143, 445, 3306, 5432, 6379, 9200, 27017
  ]

  /**
   * セキュアなfetch実行
   */
  static async fetch(
    url: string,
    options: SecureFetchOptions = {}
  ): Promise<Response> {
    const {
      maxRedirects = this.MAX_REDIRECTS,
      timeout = this.DEFAULT_TIMEOUT,
      allowPrivateIPs = false,
      allowedDomains,
      retryOptions,
      ...fetchOptions
    } = options

    // URL検証
    if (!this.validateURL(url, { allowPrivateIPs, allowedDomains })) {
      throw new Error(`Unsafe URL blocked: ${url}`)
    }

    // タイムアウト設定
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      // リトライハンドラーの設定
      if (retryOptions) {
        return await RetryHandler.execute(
          () => this.executeFetch(url, {
            ...fetchOptions,
            signal: controller.signal
          }, maxRedirects),
          {
            maxAttempts: retryOptions.maxAttempts || 3,
            retryableErrors: ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED']
          }
        )
      }

      // 通常のfetch実行
      return await this.executeFetch(url, {
        ...fetchOptions,
        signal: controller.signal
      }, maxRedirects)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  /**
   * fetch実行（リダイレクト処理付き）
   */
  private static async executeFetch(
    url: string,
    options: RequestInit,
    maxRedirects: number
  ): Promise<Response> {
    let currentUrl = url
    let redirectCount = 0

    while (redirectCount <= maxRedirects) {
      const response = await fetch(currentUrl, {
        ...options,
        redirect: 'manual' // 手動でリダイレクトを処理
      })

      // リダイレクトではない場合は結果を返す
      if (!this.isRedirect(response.status)) {
        return response
      }

      // リダイレクト先のURL取得
      const location = response.headers.get('location')
      if (!location) {
        throw new Error('Redirect response without location header')
      }

      // 絶対URLに変換
      currentUrl = new URL(location, currentUrl).toString()

      // リダイレクト先の検証
      if (!this.validateURL(currentUrl, { allowPrivateIPs: false })) {
        throw new Error(`Unsafe redirect blocked: ${currentUrl}`)
      }

      redirectCount++
      
      logger.debug('Following redirect', {
        from: url,
        to: currentUrl,
        count: redirectCount
      })
    }

    throw new Error(`Too many redirects (>${maxRedirects})`)
  }

  /**
   * URL検証
   */
  private static validateURL(
    url: string,
    options: {
      allowPrivateIPs?: boolean
      allowedDomains?: string[]
    }
  ): boolean {
    try {
      const parsed = new URL(url)

      // プロトコルチェック
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        logger.warn('Invalid protocol for fetch', { url, protocol: parsed.protocol })
        return false
      }

      // SSRF保護
      if (!options.allowPrivateIPs && !URLValidator.isSSRFSafe(url)) {
        logger.warn('SSRF attempt blocked', { url })
        return false
      }

      // ポートチェック
      if (parsed.port) {
        const port = parseInt(parsed.port)
        if (this.BLOCKED_PORTS.includes(port)) {
          logger.warn('Blocked port access attempt', { url, port })
          return false
        }
      }

      // ドメイン許可リスト
      if (options.allowedDomains && options.allowedDomains.length > 0) {
        const hostname = parsed.hostname.toLowerCase()
        const isAllowed = options.allowedDomains.some(domain => 
          hostname === domain || hostname.endsWith(`.${domain}`)
        )
        
        if (!isAllowed) {
          logger.warn('Domain not in allowlist', { url, hostname })
          return false
        }
      }

      // DNSリバインディング攻撃の防止
      if (this.isDNSRebindingAttempt(parsed.hostname)) {
        logger.warn('DNS rebinding attempt detected', { url })
        return false
      }

      return true
    } catch (error) {
      logger.error('URL validation error', { url, error })
      return false
    }
  }

  /**
   * DNSリバインディング攻撃の検出
   */
  private static isDNSRebindingAttempt(hostname: string): boolean {
    // 数値IPアドレスとドメイン名の混在をチェック
    const ipPattern = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/
    const hasNumbers = /\d/.test(hostname)
    const hasDots = hostname.includes('.')
    
    // IPアドレスのような形式だが不正な範囲
    if (ipPattern.test(hostname)) {
      const parts = hostname.split('.').map(Number)
      if (parts.some(p => p > 255)) {
        return true
      }
    }
    
    // 疑わしいパターン（例: 127.0.0.1.attacker.com）
    if (hasNumbers && hasDots && hostname.split('.').length > 4) {
      return true
    }
    
    return false
  }

  /**
   * リダイレクトステータスコードの判定
   */
  private static isRedirect(status: number): boolean {
    return [301, 302, 303, 307, 308].includes(status)
  }

  /**
   * JSON取得用ヘルパー
   */
  static async fetchJSON<T = any>(
    url: string,
    options: SecureFetchOptions = {}
  ): Promise<T> {
    const response = await this.fetch(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('application/json')) {
      throw new Error(`Expected JSON response, got ${contentType}`)
    }

    return response.json()
  }

  /**
   * 外部API呼び出し用ラッパー
   */
  static async callExternalAPI<T = any>(
    url: string,
    options: {
      method?: string
      headers?: Record<string, string>
      body?: any
      apiKey?: string
      timeout?: number
    } = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      apiKey,
      timeout = 30000
    } = options

    // APIキーの設定
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // リクエスト実行
    const response = await this.fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      timeout,
      retryOptions: {
        maxAttempts: 3,
        retryableStatusCodes: [429, 502, 503, 504]
      }
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      logger.error('External API call failed', {
        url,
        status: response.status,
        error: errorText
      })
      throw new Error(`API call failed: ${response.status} ${errorText}`)
    }

    return response.json()
  }

  /**
   * ヘルスチェック用
   */
  static async healthCheck(
    url: string,
    timeout: number = 5000
  ): Promise<boolean> {
    try {
      const response = await this.fetch(url, {
        method: 'HEAD',
        timeout
      })
      return response.ok
    } catch {
      return false
    }
  }
}

/**
 * グローバルfetchのオーバーライド（オプション）
 */
export function overrideGlobalFetch(): void {
  const originalFetch = global.fetch
  
  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : 
                input instanceof URL ? input.toString() : 
                input.url

    logger.debug('Intercepted fetch request', { url })

    // 安全性チェック
    if (!URLValidator.isSSRFSafe(url)) {
      logger.error('Blocked unsafe fetch', { url })
      throw new Error('Unsafe request blocked')
    }

    return originalFetch(input, init)
  }
}