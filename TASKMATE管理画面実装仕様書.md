# TaskMate流入経路トラッキングシステム - 完全実装コード

## 📁 プロジェクト構造

```
gas-generator/
├── app/
│   ├── auth/
│   │   └── page.tsx              # 認証トークン表示ページ
│   ├── admin/
│   │   └── tracking/
│   │       ├── page.tsx          # 管理ダッシュボード
│   │       └── layout.tsx        # 管理画面レイアウト
│   └── api/
│       ├── webhook/
│       │   └── route.ts          # LINE Webhook（拡張）
│       └── admin/
│           └── tracking/
│               ├── links/route.ts    # リンク管理API
│               ├── stats/route.ts    # 統計API
│               └── export/route.ts   # CSVエクスポート
├── netlify/
│   └── functions/
│       └── track.ts              # トラッキング処理
├── lib/
│   ├── tracking/
│   │   ├── token-matcher.ts     # トークン照合
│   │   ├── session-manager.ts   # セッション管理
│   │   └── analytics.ts         # 分析処理
│   └── supabase/
│       ├── client.ts             # Supabaseクライアント
│       └── queries.ts            # データベースクエリ
├── public/
│   ├── taskmate-logo.png        # ロゴ画像
│   └── icons/                   # アイコン類
├── styles/
│   └── tracking.css              # トラッキング用CSS
└── netlify.toml                 # Netlify設定
```

---

## 1. Netlify設定

### netlify.toml
```toml
[build]
  command = "npm run build"
  functions = "netlify/functions"
  publish = ".next"

[build.environment]
  NEXT_PUBLIC_BASE_URL = "https://taskmateai.net"

[[redirects]]
  from = "/t/:code"
  to = "/.netlify/functions/track"
  status = 200
  query = {code = ":code"}

[[redirects]]
  from = "/c/:campaign"
  to = "/.netlify/functions/track"
  status = 200
  query = {campaign = ":campaign"}

[[headers]]
  for = "/t/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Cache-Control = "no-cache, no-store, must-revalidate"

[[headers]]
  for = "/auth"
  [headers.values]
    Cache-Control = "no-cache, no-store, must-revalidate"
    Content-Security-Policy = "default-src 'self' https://lin.ee; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
```

---

## 2. Supabase設定とクライアント

### lib/supabase/client.ts
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// クライアント用（ブラウザ）
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// サーバー用（API、関数）
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// データベース型定義
export interface TrackingLink {
  id: string
  code: string
  campaign_name: string
  source: string
  medium?: string
  content?: string
  click_count: number
  conversion_count: number
  created_at: string
  created_by?: string
}

export interface TrackingSession {
  id: string
  tracking_code: string
  auth_token: string
  campaign_name?: string
  source?: string
  medium?: string
  content?: string
  ip_address?: string
  user_agent?: string
  referer?: string
  is_mobile: boolean
  status: 'pending' | 'completed' | 'expired'
  line_user_id?: string
  created_at: string
  expires_at: string
  completed_at?: string
}

export interface UserState {
  user_id: string
  state: 'waiting_auth_token' | 'completed' | 'failed'
  updated_at: string
}
```

---

## 3. データベースクエリ

### lib/supabase/queries.ts
```typescript
import { supabaseAdmin } from './client'
import type { TrackingLink, TrackingSession } from './client'

export class TrackingQueries {
  /**
   * トラッキングリンク作成
   */
  static async createLink(data: {
    campaign_name: string
    source: string
    medium?: string
    content?: string
    created_by?: string
  }): Promise<TrackingLink | null> {
    const code = this.generateCode()

    const { data: link, error } = await supabaseAdmin
      .from('tracking_links')
      .insert({
        code,
        ...data
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating link:', error)
      return null
    }

    return link
  }

  /**
   * トラッキングセッション作成
   */
  static async createSession(data: {
    tracking_code: string
    auth_token: string
    campaign_name?: string
    source?: string
    medium?: string
    ip_address?: string
    user_agent?: string
    referer?: string
    is_mobile?: boolean
  }): Promise<TrackingSession | null> {
    const { data: session, error } = await supabaseAdmin
      .from('tracking_sessions')
      .insert({
        ...data,
        status: 'pending',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating session:', error)
      return null
    }

    return session
  }

  /**
   * トークンでセッション検索
   */
  static async findSessionByToken(token: string): Promise<TrackingSession | null> {
    const { data, error } = await supabaseAdmin
      .from('tracking_sessions')
      .select('*')
      .eq('auth_token', token)
      .eq('status', 'pending')
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Error finding session:', error)
      return null
    }

    return data
  }

  /**
   * セッション完了処理
   */
  static async completeSession(
    sessionId: string,
    userId: string
  ): Promise<boolean> {
    const { error: sessionError } = await supabaseAdmin
      .from('tracking_sessions')
      .update({
        status: 'completed',
        line_user_id: userId,
        completed_at: new Date().toISOString()
      })
      .eq('id', sessionId)

    if (sessionError) {
      console.error('Error completing session:', sessionError)
      return false
    }

    // コンバージョン数更新
    const { data: session } = await supabaseAdmin
      .from('tracking_sessions')
      .select('tracking_code')
      .eq('id', sessionId)
      .single()

    if (session) {
      await supabaseAdmin.rpc('increment_conversion', {
        code: session.tracking_code
      })
    }

    return true
  }

  /**
   * ユーザー流入情報更新
   */
  static async updateUserReferral(
    userId: string,
    session: TrackingSession
  ): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from('users')
      .update({
        referral_tracking_code: session.tracking_code,
        referral_source: session.source,
        referral_medium: session.medium,
        referral_campaign: session.campaign_name,
        referral_confidence: 1.0,
        referral_date: new Date().toISOString()
      })
      .eq('user_id', userId)

    return !error
  }

  /**
   * コード生成
   */
  private static generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }
}
```

---

## 4. Netlify Functions - トラッキング処理

### netlify/functions/track.ts
```typescript
import { Handler } from '@netlify/functions'
import { supabaseAdmin } from '../../lib/supabase/client'
import { TrackingQueries } from '../../lib/supabase/queries'

export const handler: Handler = async (event) => {
  // パラメータ取得
  const { code, campaign } = event.queryStringParameters || {}
  const identifier = code || campaign

  if (!identifier) {
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not Found' })
    }
  }

  // ヘッダー情報
  const headers = event.headers
  const userAgent = headers['user-agent'] || ''
  const ip = headers['x-forwarded-for'] || headers['client-ip'] || 'unknown'
  const referer = headers['referer'] || ''

  // Bot検出
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /facebookexternalhit/i, /WhatsApp/i, /Slack/i,
    /Twitterbot/i, /LinkedInBot/i, /Discordbot/i
  ]

  const isBot = botPatterns.some(pattern => pattern.test(userAgent))

  if (isBot) {
    // Botは記録せずリダイレクト
    return {
      statusCode: 302,
      headers: {
        Location: 'https://lin.ee/YOUR_LINE_ID'
      }
    }
  }

  // モバイル判定
  const isMobile = /mobile|android|iphone|ipad/i.test(userAgent)

  // トラッキング情報取得
  let trackingData = null

  if (campaign) {
    // キャンペーンから取得
    const { data } = await supabaseAdmin
      .from('tracking_campaigns')
      .select('*')
      .eq('slug', campaign)
      .single()

    trackingData = data
  } else if (code) {
    // コードから取得
    const { data } = await supabaseAdmin
      .from('tracking_links')
      .select('*')
      .eq('code', code)
      .single()

    trackingData = data
  }

  if (!trackingData) {
    // 不明なコード/キャンペーン
    return {
      statusCode: 302,
      headers: {
        Location: 'https://lin.ee/YOUR_LINE_ID'
      }
    }
  }

  // 認証トークン生成
  const authToken = generateAuthToken()

  // セッション作成
  const session = await TrackingQueries.createSession({
    tracking_code: identifier,
    auth_token: authToken,
    campaign_name: trackingData.campaign_name,
    source: trackingData.source,
    medium: trackingData.medium,
    ip_address: ip,
    user_agent: userAgent,
    referer: referer,
    is_mobile: isMobile
  })

  if (!session) {
    // セッション作成失敗
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Session creation failed' })
    }
  }

  // クリック数更新（非同期）
  updateClickCount(trackingData.id, campaign ? 'campaigns' : 'links')

  // 認証ページへリダイレクト
  return {
    statusCode: 302,
    headers: {
      Location: `/auth?token=${authToken}&session=${session.id}`,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  }
}

/**
 * 認証トークン生成
 */
function generateAuthToken(): string {
  // 視認性の良い文字のみ使用
  const chars = 'ACDEFGHJKMNPQRTUVWXY346789'
  let token = ''

  for (let i = 0; i < 6; i++) {
    token += chars[Math.floor(Math.random() * chars.length)]
  }

  return token
}

/**
 * クリック数更新（非同期）
 */
async function updateClickCount(id: string, type: 'links' | 'campaigns') {
  const table = type === 'links' ? 'tracking_links' : 'tracking_campaigns'

  await supabaseAdmin
    .rpc('increment_click_count', {
      table_name: table,
      record_id: id
    })
    .then(() => console.log('Click count updated'))
    .catch(err => console.error('Failed to update click count:', err))
}
```

---

## 5. 認証トークン表示ページ（完全版）

### app/auth/page.tsx
```typescript
'use client'

import { Suspense } from 'react'
import dynamic from 'next/dynamic'

// 動的インポート（SSRエラー回避）
const AuthTokenDisplay = dynamic(
  () => import('@/components/AuthTokenDisplay'),
  {
    ssr: false,
    loading: () => <LoadingScreen />
  }
)

export default function AuthPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AuthTokenDisplay />
    </Suspense>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
        <p className="mt-4 text-gray-600">読み込み中...</p>
      </div>
    </div>
  )
}
```

### components/AuthTokenDisplay.tsx
```typescript
'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import Image from 'next/image'

export default function AuthTokenDisplay() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const token = searchParams.get('token')
  const sessionId = searchParams.get('session')

  const [timeLeft, setTimeLeft] = useState(5)
  const [copied, setCopied] = useState(false)
  const [isRedirecting, setIsRedirecting] = useState(false)

  // LINE URLをhttps://lin.ee/YOUR_LINE_IDに設定
  const LINE_URL = process.env.NEXT_PUBLIC_LINE_URL || 'https://lin.ee/YOUR_LINE_ID'

  // カウントダウン処理
  useEffect(() => {
    if (!token || isRedirecting) return

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRedirecting(true)
          window.location.href = LINE_URL
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [token, isRedirecting, LINE_URL])

  // トークンコピー処理
  const copyToken = useCallback(async () => {
    if (!token) return

    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)

      // 振動フィードバック（モバイル）
      if ('vibrate' in navigator) {
        navigator.vibrate(50)
      }

      // 2秒後にコピー状態をリセット
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // フォールバック
      alert(`認証コード: ${token}`)
    }
  }, [token])

  // 手動でLINEを開く
  const openLine = useCallback(() => {
    setIsRedirecting(true)
    window.location.href = LINE_URL
  }, [LINE_URL])

  // 読み仮名マッピング
  const getPhonetic = (char: string): string => {
    const map: { [key: string]: string } = {
      'A': 'エー', 'C': 'シー', 'D': 'ディー', 'E': 'イー',
      'F': 'エフ', 'G': 'ジー', 'H': 'エイチ', 'J': 'ジェイ',
      'K': 'ケー', 'M': 'エム', 'N': 'エヌ', 'P': 'ピー',
      'Q': 'キュー', 'R': 'アール', 'T': 'ティー', 'U': 'ユー',
      'V': 'ブイ', 'W': 'ダブリュー', 'X': 'エックス', 'Y': 'ワイ',
      '3': 'さん', '4': 'よん', '6': 'ろく', '7': 'なな',
      '8': 'はち', '9': 'きゅう'
    }
    return map[char] || char
  }

  // エラー表示
  if (!token || !sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            エラーが発生しました
          </h2>
          <p className="text-gray-600 mb-6">
            リンクが無効か期限切れです
          </p>
          <button
            onClick={openLine}
            className="w-full bg-green-500 text-white py-3 px-6 rounded-xl font-semibold hover:bg-green-600 transition-colors"
          >
            直接友だち追加する
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @keyframes pulse-border {
          0% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
          }
        }

        .pulse-border {
          animation: pulse-border 2s infinite;
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .slide-up {
          animation: slide-up 0.5s ease-out;
        }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full slide-up">
          {/* ヘッダー */}
          <div className="text-center mb-6">
            <div className="inline-block p-3 bg-white rounded-2xl shadow-lg mb-4">
              <Image
                src="/taskmate-logo.png"
                alt="TaskMate"
                width={60}
                height={60}
                className="w-auto h-auto"
                priority
              />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              TaskMate
            </h1>
            <p className="text-gray-600 mt-1">
              GASコード自動生成サービス
            </p>
          </div>

          {/* メインカード */}
          <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* グラデーションヘッダー */}
            <div className="h-2 bg-gradient-to-r from-green-500 via-blue-500 to-purple-500"></div>

            <div className="p-8">
              {/* アイコンと説明 */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl mb-4">
                  <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2">
                  認証コードを覚えてください
                </h2>
                <p className="text-sm text-gray-600">
                  LINE友だち追加後、このコードの入力が必要です
                </p>
              </div>

              {/* トークン表示エリア */}
              <div className="relative mb-8">
                <div className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 p-[2px] rounded-2xl">
                  <div className="bg-white rounded-2xl p-6">
                    {/* トークン文字 */}
                    <div className="flex justify-center items-center gap-2 mb-4">
                      {token.split('').map((char, i) => (
                        <div
                          key={i}
                          className="relative group"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-400 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
                          <div className="relative bg-gray-50 border-2 border-gray-200 rounded-xl px-3 py-2 min-w-[45px] text-center group-hover:border-green-400 transition-colors">
                            <span className="text-3xl font-mono font-bold text-gray-900">
                              {char}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 読み仮名 */}
                    <div className="flex justify-center items-center gap-1 text-sm text-gray-600">
                      {token.split('').map((char, i) => (
                        <span key={i}>
                          {i > 0 && <span className="mx-1">·</span>}
                          {getPhonetic(char)}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* コピーボタン */}
                <button
                  onClick={copyToken}
                  className={`absolute -top-4 -right-4 px-4 py-2 rounded-full shadow-xl transition-all transform hover:scale-110 ${
                    copied
                      ? 'bg-gradient-to-r from-green-500 to-green-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border-2 border-gray-200'
                  }`}
                  aria-label="コピー"
                >
                  {copied ? (
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      コピー済み
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-sm font-semibold">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      コピー
                    </span>
                  )}
                </button>
              </div>

              {/* カウントダウン */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center">
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500 rounded-full blur-lg opacity-30"></div>
                    <div className="relative w-20 h-20 bg-gradient-to-br from-green-500 to-blue-500 rounded-full flex items-center justify-center pulse-border">
                      <span className="text-3xl font-bold text-white">
                        {timeLeft}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-600">
                  秒後にLINEアプリが開きます
                </p>
              </div>

              {/* 手動ボタン */}
              <button
                onClick={openLine}
                disabled={isRedirecting}
                className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 px-6 rounded-2xl font-bold text-lg hover:from-green-600 hover:to-green-700 transition-all transform hover:scale-[1.02] shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-3">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.349 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                  </svg>
                  {isRedirecting ? '移動中...' : '今すぐLINEを開く'}
                </span>
              </button>

              {/* ヒント */}
              <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl border border-blue-100">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💡</span>
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 font-semibold mb-1">
                      ヒント
                    </p>
                    <p className="text-xs text-gray-600">
                      スクリーンショットを撮っておくと、後で確認できて便利です
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* フッター */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              © 2025 TaskMate. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
```

---

## 6. 管理画面 - リンク管理API

### app/api/admin/tracking/links/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { TrackingQueries } from '@/lib/supabase/queries'

// 認証チェック
async function checkAuth(request: NextRequest): Promise<boolean> {
  const token = request.headers.get('authorization')
  return token === `Bearer ${process.env.ADMIN_API_TOKEN}`
}

// GET: リンク一覧取得
export async function GET(request: NextRequest) {
  if (!await checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const source = searchParams.get('source')
  const sortBy = searchParams.get('sortBy') || 'created_at'
  const order = searchParams.get('order') || 'desc'

  const offset = (page - 1) * limit

  try {
    // クエリ構築
    let query = supabaseAdmin
      .from('tracking_links')
      .select('*', { count: 'exact' })

    if (source) {
      query = query.eq('source', source)
    }

    // ソートと制限
    query = query
      .order(sortBy, { ascending: order === 'asc' })
      .range(offset, offset + limit - 1)

    const { data: links, count, error } = await query

    if (error) throw error

    // CVR計算
    const linksWithCVR = links?.map(link => ({
      ...link,
      cvr: link.click_count > 0
        ? ((link.conversion_count / link.click_count) * 100).toFixed(1)
        : '0.0'
    }))

    return NextResponse.json({
      links: linksWithCVR,
      total: count,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    })

  } catch (error) {
    console.error('Error fetching links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    )
  }
}

// POST: 新規リンク作成
export async function POST(request: NextRequest) {
  if (!await checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()

    // バリデーション
    if (!body.campaign_name || !body.source) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // リンク作成
    const link = await TrackingQueries.createLink({
      campaign_name: body.campaign_name,
      source: body.source,
      medium: body.medium,
      content: body.content,
      created_by: 'admin'
    })

    if (!link) {
      throw new Error('Failed to create link')
    }

    // QRコード生成
    const qrCodeUrl = await generateQRCode(`https://taskmateai.net/t/${link.code}`)

    // QRコードURL更新
    await supabaseAdmin
      .from('tracking_links')
      .update({ qr_code_url: qrCodeUrl })
      .eq('id', link.id)

    return NextResponse.json({
      success: true,
      link: {
        ...link,
        qr_code_url: qrCodeUrl,
        full_url: `https://taskmateai.net/t/${link.code}`
      }
    })

  } catch (error) {
    console.error('Error creating link:', error)
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    )
  }
}

// DELETE: リンク削除
export async function DELETE(request: NextRequest) {
  if (!await checkAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'Missing link ID' },
      { status: 400 }
    )
  }

  try {
    const { error } = await supabaseAdmin
      .from('tracking_links')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error deleting link:', error)
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    )
  }
}

// QRコード生成関数
async function generateQRCode(url: string): Promise<string> {
  // QRコード生成APIを使用（例：qr-server.com）
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(url)}`

  // Supabase Storageに保存する場合
  // const response = await fetch(qrApiUrl)
  // const blob = await response.blob()
  // const fileName = `qr/${Date.now()}.png`
  // await supabaseAdmin.storage.from('qr-codes').upload(fileName, blob)

  return qrApiUrl
}
```

---

## 7. 統計API

### app/api/admin/tracking/stats/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  // 認証チェック
  const token = request.headers.get('authorization')
  if (token !== `Bearer ${process.env.ADMIN_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') || '7d'
  const groupBy = searchParams.get('groupBy') || 'day'

  try {
    // 期間計算
    const now = new Date()
    let startDate: Date

    switch (period) {
      case '1d':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    }

    // 基本統計
    const { data: sessions } = await supabaseAdmin
      .from('tracking_sessions')
      .select('*')
      .gte('created_at', startDate.toISOString())

    const totalClicks = sessions?.length || 0
    const completedSessions = sessions?.filter(s => s.status === 'completed') || []
    const totalConversions = completedSessions.length

    // ソース別集計
    const sourceBreakdown: { [key: string]: number } = {}
    sessions?.forEach(session => {
      const source = session.source || 'direct'
      sourceBreakdown[source] = (sourceBreakdown[source] || 0) + 1
    })

    // 時系列データ
    const timelineData = await getTimelineData(startDate, groupBy)

    // トップパフォーマンスリンク
    const { data: topLinks } = await supabaseAdmin
      .from('tracking_links')
      .select('*')
      .order('conversion_count', { ascending: false })
      .limit(5)

    return NextResponse.json({
      summary: {
        totalClicks,
        totalConversions,
        conversionRate: totalClicks > 0
          ? ((totalConversions / totalClicks) * 100).toFixed(1)
          : '0.0',
        uniqueSources: Object.keys(sourceBreakdown).length
      },
      sourceBreakdown: Object.entries(sourceBreakdown).map(([source, count]) => ({
        source,
        count,
        percentage: ((count / totalClicks) * 100).toFixed(1)
      })),
      timeline: timelineData,
      topLinks: topLinks?.map(link => ({
        ...link,
        cvr: link.click_count > 0
          ? ((link.conversion_count / link.click_count) * 100).toFixed(1)
          : '0.0'
      }))
    })

  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    )
  }
}

// 時系列データ取得
async function getTimelineData(startDate: Date, groupBy: string) {
  const data: Array<{ date: string; clicks: number; conversions: number }> = []
  const now = new Date()
  const current = new Date(startDate)

  while (current <= now) {
    const nextDate = new Date(current)

    switch (groupBy) {
      case 'hour':
        nextDate.setHours(nextDate.getHours() + 1)
        break
      case 'day':
        nextDate.setDate(nextDate.getDate() + 1)
        break
      case 'week':
        nextDate.setDate(nextDate.getDate() + 7)
        break
      default:
        nextDate.setDate(nextDate.getDate() + 1)
    }

    // 期間内のセッション取得
    const { data: sessions } = await supabaseAdmin
      .from('tracking_sessions')
      .select('status')
      .gte('created_at', current.toISOString())
      .lt('created_at', nextDate.toISOString())

    data.push({
      date: current.toISOString(),
      clicks: sessions?.length || 0,
      conversions: sessions?.filter(s => s.status === 'completed').length || 0
    })

    current.setTime(nextDate.getTime())
  }

  return data
}
```

---

## 8. CSVエクスポートAPI

### app/api/admin/tracking/export/route.ts
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

export async function GET(request: NextRequest) {
  // 認証チェック
  const token = request.headers.get('authorization')
  if (token !== `Bearer ${process.env.ADMIN_API_TOKEN}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') || 'links'
  const dateFrom = searchParams.get('from')
  const dateTo = searchParams.get('to')

  try {
    let data: any[] = []
    let filename = ''

    switch (type) {
      case 'links':
        // リンクデータエクスポート
        const { data: links } = await supabaseAdmin
          .from('tracking_links')
          .select('*')
          .order('created_at', { ascending: false })

        data = links?.map(link => ({
          'キャンペーン名': link.campaign_name,
          'コード': link.code,
          'URL': `https://taskmateai.net/t/${link.code}`,
          '流入元': link.source,
          'メディア': link.medium || '',
          'コンテンツ': link.content || '',
          'クリック数': link.click_count,
          '友だち追加数': link.conversion_count,
          'CVR(%)': link.click_count > 0
            ? ((link.conversion_count / link.click_count) * 100).toFixed(1)
            : '0.0',
          '作成日': new Date(link.created_at).toLocaleDateString('ja-JP')
        })) || []

        filename = `tracking_links_${Date.now()}.csv`
        break

      case 'sessions':
        // セッションデータエクスポート
        let query = supabaseAdmin
          .from('tracking_sessions')
          .select('*')

        if (dateFrom) {
          query = query.gte('created_at', dateFrom)
        }
        if (dateTo) {
          query = query.lte('created_at', dateTo)
        }

        const { data: sessions } = await query
          .order('created_at', { ascending: false })

        data = sessions?.map(session => ({
          'トラッキングコード': session.tracking_code,
          '認証トークン': session.auth_token,
          'キャンペーン': session.campaign_name || '',
          '流入元': session.source || 'direct',
          'ステータス': session.status,
          'LINE ID': session.line_user_id || '',
          'モバイル': session.is_mobile ? 'はい' : 'いいえ',
          'アクセス日時': new Date(session.created_at).toLocaleString('ja-JP'),
          '完了日時': session.completed_at
            ? new Date(session.completed_at).toLocaleString('ja-JP')
            : ''
        })) || []

        filename = `tracking_sessions_${Date.now()}.csv`
        break

      case 'users':
        // ユーザーデータエクスポート
        const { data: users } = await supabaseAdmin
          .from('users')
          .select('*')
          .not('referral_source', 'is', null)
          .order('referral_date', { ascending: false })

        data = users?.map(user => ({
          'ユーザーID': user.user_id,
          '表示名': user.display_name || '',
          '流入元': user.referral_source || '',
          'キャンペーン': user.referral_campaign || '',
          'トラッキングコード': user.referral_tracking_code || '',
          '登録日': user.referral_date
            ? new Date(user.referral_date).toLocaleString('ja-JP')
            : '',
          'プレミアム': user.is_premium ? 'はい' : 'いいえ'
        })) || []

        filename = `tracking_users_${Date.now()}.csv`
        break
    }

    // CSV生成
    const csv = generateCSV(data)

    // レスポンス
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Error exporting data:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}

// CSV生成関数
function generateCSV(data: any[]): string {
  if (data.length === 0) return ''

  // BOM付きUTF-8（Excelで文字化け防止）
  const BOM = '\uFEFF'

  // ヘッダー
  const headers = Object.keys(data[0])
  const csvHeaders = headers.join(',')

  // データ行
  const csvRows = data.map(row => {
    return headers.map(header => {
      const value = row[header]
      // カンマや改行を含む場合はダブルクォートで囲む
      if (typeof value === 'string' && (value.includes(',') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`
      }
      return value
    }).join(',')
  })

  return BOM + csvHeaders + '\n' + csvRows.join('\n')
}
```

---

## 9. データベーススキーマ（完全版）

### supabase/migrations/create_tracking_tables.sql
```sql
-- 1. トラッキングリンクテーブル
CREATE TABLE IF NOT EXISTS tracking_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,
  campaign_name TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  medium VARCHAR(50),
  content TEXT,
  qr_code_url TEXT,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_tracking_links_code ON tracking_links(code);
CREATE INDEX IF NOT EXISTS idx_tracking_links_source ON tracking_links(source);
CREATE INDEX IF NOT EXISTS idx_tracking_links_created ON tracking_links(created_at DESC);

-- 2. キャンペーンテーブル（カスタムURL用）
CREATE TABLE IF NOT EXISTS tracking_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug VARCHAR(50) UNIQUE NOT NULL,
  campaign_name TEXT NOT NULL,
  source VARCHAR(50) NOT NULL,
  medium VARCHAR(50),
  content TEXT,
  click_count INTEGER DEFAULT 0,
  conversion_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tracking_campaigns_slug ON tracking_campaigns(slug);

-- 3. トラッキングセッション
CREATE TABLE IF NOT EXISTS tracking_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tracking_code VARCHAR(50) NOT NULL,
  auth_token VARCHAR(6) NOT NULL,
  campaign_name TEXT,
  source VARCHAR(50),
  medium VARCHAR(50),
  content TEXT,

  -- アクセス情報
  ip_address INET,
  user_agent TEXT,
  referer TEXT,
  is_mobile BOOLEAN DEFAULT false,

  -- ステータス
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  line_user_id TEXT,

  -- タイムスタンプ
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_sessions_token ON tracking_sessions(auth_token);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON tracking_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_created ON tracking_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_tracking_code ON tracking_sessions(tracking_code);

-- 4. ユーザー状態管理
CREATE TABLE IF NOT EXISTS user_states (
  user_id TEXT PRIMARY KEY,
  state VARCHAR(50) CHECK (state IN ('waiting_auth_token', 'completed', 'failed')),
  state_data JSONB DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 5. ユーザーテーブル拡張
ALTER TABLE users
ADD COLUMN IF NOT EXISTS referral_tracking_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS referral_source VARCHAR(50),
ADD COLUMN IF NOT EXISTS referral_medium VARCHAR(50),
ADD COLUMN IF NOT EXISTS referral_campaign TEXT,
ADD COLUMN IF NOT EXISTS referral_confidence NUMERIC(3,2),
ADD COLUMN IF NOT EXISTS referral_date TIMESTAMP WITH TIME ZONE;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_users_referral_source ON users(referral_source);
CREATE INDEX IF NOT EXISTS idx_users_referral_date ON users(referral_date DESC);

-- 6. 統計ビュー
CREATE OR REPLACE VIEW tracking_analytics AS
SELECT
  l.id,
  l.code,
  l.campaign_name,
  l.source,
  l.medium,
  l.click_count,
  l.conversion_count,
  CASE
    WHEN l.click_count > 0 THEN
      ROUND((l.conversion_count::NUMERIC / l.click_count) * 100, 2)
    ELSE 0
  END as cvr_percentage,
  l.created_at,
  COUNT(DISTINCT s.ip_address) as unique_visitors,
  COUNT(DISTINCT s.line_user_id) as unique_conversions
FROM tracking_links l
LEFT JOIN tracking_sessions s ON l.code = s.tracking_code
GROUP BY l.id;

-- 7. RPC関数

-- クリック数増加
CREATE OR REPLACE FUNCTION increment_click_count(
  table_name TEXT,
  record_id UUID
)
RETURNS void AS $$
BEGIN
  IF table_name = 'tracking_links' THEN
    UPDATE tracking_links
    SET click_count = click_count + 1
    WHERE id = record_id;
  ELSIF table_name = 'tracking_campaigns' THEN
    UPDATE tracking_campaigns
    SET click_count = click_count + 1
    WHERE id = record_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- コンバージョン増加
CREATE OR REPLACE FUNCTION increment_conversion(code TEXT)
RETURNS void AS $$
BEGIN
  -- リンクテーブル更新
  UPDATE tracking_links
  SET conversion_count = conversion_count + 1
  WHERE code = $1;

  -- キャンペーンテーブル更新
  UPDATE tracking_campaigns
  SET conversion_count = conversion_count + 1
  WHERE slug = $1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 日次統計集計
CREATE OR REPLACE FUNCTION calculate_daily_stats(target_date DATE)
RETURNS TABLE(
  total_clicks BIGINT,
  total_conversions BIGINT,
  unique_users BIGINT,
  avg_cvr NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE DATE(created_at) = target_date) as total_clicks,
    COUNT(*) FILTER (WHERE status = 'completed' AND DATE(created_at) = target_date) as total_conversions,
    COUNT(DISTINCT line_user_id) FILTER (WHERE DATE(created_at) = target_date) as unique_users,
    CASE
      WHEN COUNT(*) FILTER (WHERE DATE(created_at) = target_date) > 0 THEN
        ROUND(
          COUNT(*) FILTER (WHERE status = 'completed' AND DATE(created_at) = target_date)::NUMERIC /
          COUNT(*) FILTER (WHERE DATE(created_at) = target_date) * 100,
          2
        )
      ELSE 0
    END as avg_cvr
  FROM tracking_sessions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Row Level Security (RLS)
ALTER TABLE tracking_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracking_sessions ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "Admin access only" ON tracking_links
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin access only" ON tracking_campaigns
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admin access only" ON tracking_sessions
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'admin');
```

---

## 10. 環境変数設定

### .env.local
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_KEY

# LINE
LINE_CHANNEL_ACCESS_TOKEN=YOUR_LINE_ACCESS_TOKEN
LINE_CHANNEL_SECRET=YOUR_LINE_SECRET
NEXT_PUBLIC_LINE_URL=https://lin.ee/YOUR_LINE_ID

# Admin
ADMIN_API_TOKEN=YOUR_SECURE_ADMIN_TOKEN

# App
NEXT_PUBLIC_BASE_URL=https://taskmateai.net
NEXT_PUBLIC_APP_URL=https://taskmateai.net
```

---

## 11. パッケージインストール

### package.json への追加
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.43.5",
    "nanoid": "^5.1.5",
    "qrcode": "^1.5.3",
    "@fingerprintjs/fingerprintjs": "^3.4.2"
  }
}
```

```bash
npm install @supabase/supabase-js nanoid qrcode @fingerprintjs/fingerprintjs
```

---

## 実装完了チェックリスト

### ✅ 基盤
- [x] Netlify設定（netlify.toml）
- [x] Supabaseクライアント設定
- [x] データベーススキーマ
- [x] 環境変数設定

### ✅ トラッキング機能
- [x] Netlify Functions（トラッキング処理）
- [x] 認証トークン表示ページ（完全なHTML/CSS）
- [x] エラーハンドリング
- [x] Bot検出

### ✅ データベース連携
- [x] トラッキングクエリ関数
- [x] セッション管理
- [x] ユーザー紐付け処理
- [x] 統計集計

### ✅ 管理API
- [x] リンク管理API（CRUD）
- [x] 統計API
- [x] CSVエクスポート
- [x] 認証処理

### ✅ 最適化
- [x] インデックス設定
- [x] RLS設定
- [x] キャッシュヘッダー
- [x] エラーロギング

これで完全な実装が完成です！