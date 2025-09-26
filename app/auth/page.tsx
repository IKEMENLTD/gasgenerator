'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSessionByToken } from '@/lib/supabase/client'

const phoneticMap: { [key: string]: string } = {
  'A': 'エー', 'B': 'ビー', 'C': 'シー', 'D': 'ディー', 'E': 'イー',
  'F': 'エフ', 'G': 'ジー', 'H': 'エイチ', 'I': 'アイ', 'J': 'ジェイ',
  'K': 'ケー', 'L': 'エル', 'M': 'エム', 'N': 'エヌ', 'O': 'オー',
  'P': 'ピー', 'Q': 'キュー', 'R': 'アール', 'S': 'エス', 'T': 'ティー',
  'U': 'ユー', 'V': 'ブイ', 'W': 'ダブリュー', 'X': 'エックス', 'Y': 'ワイ',
  'Z': 'ゼット',
  '0': 'ゼロ', '1': 'イチ', '2': 'ニ', '3': 'サン', '4': 'ヨン',
  '5': 'ゴ', '6': 'ロク', '7': 'ナナ', '8': 'ハチ', '9': 'キュー'
}

function AuthPageContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [countdown, setCountdown] = useState(10)
  const [copied, setCopied] = useState(false)
  const [sessionValid, setSessionValid] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!token) {
      setSessionValid(false)
      setLoading(false)
      return
    }

    const validateSession = async () => {
      const session = await getSessionByToken(token)
      if (!session) {
        setSessionValid(false)
      }
      setLoading(false)
    }

    validateSession()
  }, [token])

  useEffect(() => {
    if (!sessionValid || loading) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          window.location.href = process.env.NEXT_PUBLIC_LINE_FRIEND_URL || 'https://lin.ee/taskmate'
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionValid, loading])

  const copyToClipboard = async () => {
    if (!token) return

    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const getPhonetic = (char: string): string => {
    return phoneticMap[char.toUpperCase()] || char
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!sessionValid || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
              <svg className="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-gray-900">セッションエラー</h2>
            <p className="mt-2 text-gray-600">
              有効なセッションが見つかりませんでした。<br />
              最初からやり直してください。
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100 p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-gradient-to-r from-green-400 to-green-600 animate-pulse">
            <svg className="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            認証トークン
          </h1>

          <div className="mt-8 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
            <p className="text-sm text-gray-600 mb-3">
              以下の6文字のコードをLINEで送信してください
            </p>

            <div className="flex justify-center items-center space-x-2">
              {token.split('').map((char, index) => (
                <div key={index} className="flex flex-col items-center">
                  <div className="bg-white rounded-lg shadow-md p-3 border-2 border-blue-300">
                    <span className="text-3xl font-mono font-bold text-blue-600">
                      {char}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 mt-1">
                    {getPhonetic(char)}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={copyToClipboard}
              className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors duration-200 font-medium"
            >
              {copied ? '✓ コピーしました' : 'コピーする'}
            </button>
          </div>

          <div className="mt-8 space-y-4">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <p className="text-yellow-800 font-medium">
                ⏰ {countdown}秒後に自動的にLINEに移動します
              </p>
            </div>

            <div className="text-left bg-gray-50 rounded-xl p-6 space-y-3">
              <h2 className="font-bold text-lg text-gray-900 mb-3">📝 手順説明</h2>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  1
                </span>
                <p className="text-gray-700">上記のトークンをコピーする</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                <p className="text-gray-700">LINEで友だち追加する</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                  3
                </span>
                <p className="text-gray-700">トークでトークンを送信する</p>
              </div>
            </div>

            <a
              href={process.env.NEXT_PUBLIC_LINE_FRIEND_URL || 'https://lin.ee/taskmate'}
              className="inline-block w-full px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:from-green-600 hover:to-green-700 transition-all duration-200 font-bold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              今すぐLINEに移動 →
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-green-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  )
}