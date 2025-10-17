/**
 * スパム検出ミドルウェア
 *
 * 🔧 修正履歴:
 * - 2025-10-17: Googleドメインのホワイトリスト追加（誤検知対策）
 */

import { logger } from '../utils/logger'

/**
 * ホワイトリストに登録された信頼できるドメイン
 * これらのドメインを含むURLはスパムとして扱わない
 */
const WHITELISTED_DOMAINS = [
  'docs.google.com',
  'drive.google.com',
  'sheets.google.com',
  'gmail.com',
  'calendar.google.com',
  'script.google.com',
  'forms.google.com',
  'sites.google.com',
  'meet.google.com'
]

/**
 * メッセージがスパムかどうかを判定
 *
 * @param messageText - 判定対象のメッセージテキスト
 * @returns スパムの場合はtrue
 */
export function isSpam(messageText: string): boolean {
  // 空メッセージはスパムではない
  if (!messageText || messageText.trim().length === 0) {
    return false
  }

  // URLを抽出
  const urls = messageText.match(/https?:\/\/[^\s]+/g) || []

  // ホワイトリストドメインのURLをカウント
  const whitelistedUrls = urls.filter(url =>
    WHITELISTED_DOMAINS.some(domain => url.includes(domain))
  )

  // ホワイトリストURLが含まれている場合はスパムではない
  if (whitelistedUrls.length > 0) {
    logger.debug('URL contains whitelisted domain, not spam', {
      urls: whitelistedUrls,
      messageLength: messageText.length
    })
    return false
  }

  // 真のスパム判定ロジック

  // 1. 同じ文字が5回以上連続（例: "aaaaaa"）
  if (/(.)\1{4,}/.test(messageText)) {
    logger.debug('Spam detected: repeated characters', {
      messageText: messageText.substring(0, 50)
    })
    return true
  }

  // 2. ランダムな文字列っぽい（数字と文字が混在して30文字以上）
  // ただし、スペースや記号が含まれていれば正常なテキスト
  if (messageText.length > 30 && /^[a-zA-Z0-9]+$/.test(messageText)) {
    logger.debug('Spam detected: random alphanumeric string', {
      messageText: messageText.substring(0, 50)
    })
    return true
  }

  // 3. 絵文字だけで10個以上（ES5互換の正規表現）
  const emojiRegex = /[\uD83D][\uDC00-\uDE4F]|[\uD83D][\uDE80-\uDEFF]|[\u2600-\u26FF]|[\u2700-\u27BF]/g
  const emojiMatches = messageText.match(emojiRegex)
  if (emojiMatches && emojiMatches.length >= 10 && messageText.length < 50) {
    logger.debug('Spam detected: too many emojis', {
      emojiCount: emojiMatches.length
    })
    return true
  }

  // 4. 非ホワイトリストURLが5個以上含まれる
  const nonWhitelistedUrls = urls.filter(url =>
    !WHITELISTED_DOMAINS.some(domain => url.includes(domain))
  )
  if (nonWhitelistedUrls.length >= 5) {
    logger.debug('Spam detected: too many non-whitelisted URLs', {
      urlCount: nonWhitelistedUrls.length
    })
    return true
  }

  // 5. 超長いURL（100文字以上）を含む（Google以外）
  const longUrls = nonWhitelistedUrls.filter(url => url.length > 100)
  if (longUrls.length > 0) {
    logger.debug('Spam detected: extremely long URL', {
      urlLength: longUrls[0].length
    })
    return true
  }

  // 6. スパムキーワードを含む
  const spamKeywords = [
    /\b(viagra|cialis|casino|lottery|jackpot)\b/i,
    /\b(出会い|アダルト|風俗)\b/i,
    /\b(稼げる|儲かる|月収\d+万円)\b/i
  ]

  for (const pattern of spamKeywords) {
    if (pattern.test(messageText)) {
      logger.debug('Spam detected: spam keyword', {
        keyword: pattern.toString()
      })
      return true
    }
  }

  // 7. 非ASCII文字が500文字以上（例: ランダムな中国語スパム）
  const nonAsciiChars = messageText.match(/[^\x00-\x7F]/g) || []
  if (nonAsciiChars.length >= 500) {
    logger.debug('Spam detected: too many non-ASCII characters', {
      count: nonAsciiChars.length
    })
    return true
  }

  // スパムではない
  return false
}

/**
 * スパム検出結果の詳細情報を取得
 * デバッグ用
 */
export function getSpamAnalysis(messageText: string): {
  isSpam: boolean
  reasons: string[]
  urls: string[]
  whitelistedUrls: string[]
} {
  const urls = messageText.match(/https?:\/\/[^\s]+/g) || []
  const whitelistedUrls = urls.filter(url =>
    WHITELISTED_DOMAINS.some(domain => url.includes(domain))
  )

  const reasons: string[] = []

  if (/(.)\1{4,}/.test(messageText)) {
    reasons.push('Repeated characters')
  }

  if (messageText.length > 30 && /^[a-zA-Z0-9]+$/.test(messageText)) {
    reasons.push('Random alphanumeric string')
  }

  const emojiRegex = /[\uD83D][\uDC00-\uDE4F]|[\uD83D][\uDE80-\uDEFF]|[\u2600-\u26FF]|[\u2700-\u27BF]/g
  const emojiMatches = messageText.match(emojiRegex)
  if (emojiMatches && emojiMatches.length >= 10 && messageText.length < 50) {
    reasons.push(`Too many emojis (${emojiMatches.length})`)
  }

  const nonWhitelistedUrls = urls.filter(url =>
    !WHITELISTED_DOMAINS.some(domain => url.includes(domain))
  )
  if (nonWhitelistedUrls.length >= 5) {
    reasons.push(`Too many non-whitelisted URLs (${nonWhitelistedUrls.length})`)
  }

  return {
    isSpam: isSpam(messageText),
    reasons,
    urls,
    whitelistedUrls
  }
}

/**
 * ホワイトリストにドメインを追加
 *
 * @param domain - 追加するドメイン（例: 'example.com'）
 */
export function addWhitelistedDomain(domain: string): void {
  if (!WHITELISTED_DOMAINS.includes(domain)) {
    WHITELISTED_DOMAINS.push(domain)
    logger.info('Domain added to whitelist', { domain })
  }
}

/**
 * 現在のホワイトリストを取得
 */
export function getWhitelistedDomains(): string[] {
  return [...WHITELISTED_DOMAINS]
}
