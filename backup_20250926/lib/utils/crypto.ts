// Edge Runtime互換のcrypto実装
import { logger } from './logger'

// LINE署名検証（Edge Runtime対応）
export async function validateLineSignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false
  
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelSecret) return false

  try {
    // Web Crypto APIを使用
    const encoder = new TextEncoder()
    const keyData = encoder.encode(channelSecret)
    const messageData = encoder.encode(body)
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signatureArrayBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      messageData
    )
    
    // Base64エンコード
    const expectedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureArrayBuffer)))
    
    // タイミング攻撃対策の比較
    return timingSafeEqual(signature, expectedSignature)
  } catch (error) {
    logger.error('Line signature validation error:', { error })
    return false
  }
}

// 独自Webhook署名生成・検証（Edge Runtime対応）
export async function generateWebhookSignature(body: string): Promise<string> {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) throw new Error('WEBHOOK_SECRET not configured')

  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(body)
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signatureArrayBuffer = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    messageData
  )
  
  // Hexエンコード
  return Array.from(new Uint8Array(signatureArrayBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function validateWebhookSignature(body: string, signature: string | null): Promise<boolean> {
  if (!signature) return false

  try {
    const expectedSignature = await generateWebhookSignature(body)
    return timingSafeEqual(signature, expectedSignature)
  } catch (error) {
    logger.error('Webhook signature validation error:', { error })
    return false
  }
}

// タイミング攻撃対策の文字列比較
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

// リクエストIDの生成（追跡用）
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36)
  // 暗号学的に安全な乱数を使用
  const array = new Uint8Array(6)
  crypto.getRandomValues(array)
  const randomPart = Array.from(array)
    .map(b => b.toString(36))
    .join('')
    .substring(0, 9)
  return `req_${timestamp}_${randomPart}`
}

// セッションIDの生成（TEXT型で統一）
export function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  // 暗号学的に安全な乱数を使用
  const array = new Uint8Array(6)
  crypto.getRandomValues(array)
  const randomPart = Array.from(array)
    .map(b => b.toString(36))
    .join('')
    .substring(0, 9)
  return `session_${timestamp}_${randomPart}`
}

// UUID v4生成（RFC 4122準拠）
export function generateUUID(): string {
  // crypto.randomUUID()はEdge Runtimeでサポートされている
  return crypto.randomUUID()
}

// 安全なランダム文字列生成（Web Crypto API使用）
export async function generateSecureToken(length: number = 32): Promise<string> {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const randomValues = new Uint8Array(length)
  crypto.getRandomValues(randomValues)
  
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[randomValues[i] % chars.length]
  }
  
  return result
}