'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    liff: any
  }
}

type LinkStatus = 'loading' | 'linking' | 'success' | 'friend-prompt' | 'error'

export default function LiffBridgePage() {
  const [status, setStatus] = useState<LinkStatus>('loading')
  const [message, setMessage] = useState('読み込み中...')
  const [lineUrl, setLineUrl] = useState<string | null>(null)
  const [sdkLoaded, setSdkLoaded] = useState(false)

  useEffect(() => {
    if (!sdkLoaded) return

    const initLiff = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const visitId = params.get('visit_id')
        const encodedLineUrl = params.get('line_url')
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID

        if (encodedLineUrl) {
          setLineUrl(decodeURIComponent(encodedLineUrl))
        }

        if (!visitId) {
          setStatus('error')
          setMessage('訪問情報が見つかりません')
          return
        }

        if (!liffId) {
          // LIFF未設定 → 直接LINEリンクへフォールバック
          if (encodedLineUrl) {
            window.location.href = decodeURIComponent(encodedLineUrl)
          }
          return
        }

        // LIFF 初期化
        setMessage('LINE連携中...')
        await window.liff.init({ liffId })

        // ログインチェック
        if (!window.liff.isLoggedIn()) {
          window.liff.login({ redirectUri: window.location.href })
          return
        }

        // プロフィール取得
        setStatus('linking')
        setMessage('アカウント連携中...')
        const profile = await window.liff.getProfile()

        // サーバーに紐付けリクエスト
        const response = await fetch('/api/link-visit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lineUserId: profile.userId,
            visitId,
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
          })
        })

        if (!response.ok) {
          throw new Error('紐付けに失敗しました')
        }

        // 友だち追加状態チェック
        const friendship = await window.liff.getFriendship()

        if (friendship.friendFlag) {
          // 既に友だち → 完了
          setStatus('success')
          setMessage(`${profile.displayName}さん、連携が完了しました！`)
          setTimeout(() => {
            if (window.liff.isInClient()) {
              window.liff.closeWindow()
            } else if (encodedLineUrl) {
              window.location.href = decodeURIComponent(encodedLineUrl)
            }
          }, 2000)
        } else {
          // 友だち追加が必要
          setStatus('friend-prompt')
          setMessage('友だち追加して利用開始！')
        }
      } catch (error) {
        console.error('LIFF error:', error)
        setStatus('error')
        setMessage('エラーが発生しました')

        // エラー時はLINE友だちURLへフォールバック
        const params = new URLSearchParams(window.location.search)
        const encodedLineUrl = params.get('line_url')
        if (encodedLineUrl) {
          setTimeout(() => {
            window.location.href = decodeURIComponent(encodedLineUrl)
          }, 2000)
        }
      }
    }

    initLiff()
  }, [sdkLoaded])

  const handleAddFriend = () => {
    if (lineUrl) {
      window.location.href = lineUrl
    }
  }

  return (
    <>
      <Script
        src="https://static.line-scdn.net/liff/edge/2/sdk.js"
        onLoad={() => setSdkLoaded(true)}
      />
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #06C755 0%, #00B900 100%)',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        color: '#fff',
        padding: '20px'
      }}>
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '20px',
          padding: '40px 30px',
          textAlign: 'center',
          maxWidth: '360px',
          width: '100%',
          boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
        }}>
          {/* ロゴ */}
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>
            {status === 'loading' || status === 'linking' ? '⏳' :
              status === 'success' ? '✅' :
                status === 'friend-prompt' ? '👋' : '⚠️'}
          </div>

          {/* メッセージ */}
          <h2 style={{
            color: '#333',
            fontSize: '18px',
            fontWeight: 'bold',
            margin: '0 0 12px'
          }}>
            {message}
          </h2>

          {/* ステータス別の補足テキスト */}
          {(status === 'loading' || status === 'linking') && (
            <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
              しばらくお待ちください...
            </p>
          )}

          {status === 'success' && (
            <p style={{ color: '#06C755', fontSize: '14px', margin: 0, fontWeight: 'bold' }}>
              まもなく画面が閉じます
            </p>
          )}

          {status === 'friend-prompt' && (
            <div>
              <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
                TaskMate AI を友だち追加して<br />便利な機能をお使いください
              </p>
              <button
                onClick={handleAddFriend}
                style={{
                  background: '#06C755',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '14px 32px',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  width: '100%'
                }}
              >
                友だち追加する
              </button>
            </div>
          )}

          {status === 'error' && lineUrl && (
            <div>
              <p style={{ color: '#888', fontSize: '14px', margin: '0 0 16px' }}>
                自動リダイレクト中...
              </p>
              <a
                href={lineUrl}
                style={{
                  color: '#06C755',
                  textDecoration: 'underline',
                  fontSize: '14px'
                }}
              >
                こちらをタップ
              </a>
            </div>
          )}
        </div>

        {/* フッター */}
        <p style={{
          marginTop: '24px',
          fontSize: '12px',
          opacity: 0.8
        }}>
          TaskMate AI
        </p>
      </div>
    </>
  )
}
