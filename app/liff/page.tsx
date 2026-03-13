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
  const [debugLog, setDebugLog] = useState<string[]>([])

  const addLog = (msg: string) => {
    setDebugLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`])
  }

  useEffect(() => {
    if (!sdkLoaded) return

    const initLiff = async () => {
      try {
        const params = new URLSearchParams(window.location.search)
        const visitId = params.get('visit_id')
        const encodedLineUrl = params.get('line_url')
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2009173525-SZzAqCLG'

        addLog(`visit_id: ${visitId || 'MISSING'}`)
        addLog(`liffId: ${liffId}`)
        addLog(`line_url: ${encodedLineUrl ? 'SET' : 'MISSING'}`)
        addLog(`userAgent: ${navigator.userAgent.substring(0, 50)}...`)

        if (encodedLineUrl) {
          setLineUrl(decodeURIComponent(encodedLineUrl))
        } else {
          // 直接アクセス時のフォールバック
          setLineUrl('https://lin.ee/4NLfSqH')
        }

        // visit_idがない場合（直接アクセス）はトラッキング連携をスキップ
        const isDirectAccess = !visitId
        if (isDirectAccess) {
          addLog('Direct access (no tracking link) - skipping visit linkage')
        }

        // LIFF 初期化
        addLog('LIFF init starting...')
        setMessage('LINE連携中...')
        await window.liff.init({ liffId })
        addLog(`LIFF init OK. isInClient: ${window.liff.isInClient()}, isLoggedIn: ${window.liff.isLoggedIn()}`)
        addLog(`LIFF OS: ${window.liff.getOS()}, Language: ${window.liff.getLanguage()}`)

        // ログインチェック
        if (!window.liff.isLoggedIn()) {
          addLog('Not logged in, redirecting to LINE login...')
          window.liff.login({ redirectUri: window.location.href })
          return
        }

        // プロフィール取得
        setStatus('linking')
        setMessage('アカウント連携中...')
        addLog('Getting profile...')
        const profile = await window.liff.getProfile()
        addLog(`Profile OK: ${profile.displayName} (${profile.userId.substring(0, 8)}...)`)

        // サーバーに紐付けリクエスト（トラッキング経由の場合のみ）
        if (visitId) {
          addLog(`POST /api/link-visit (visitId: ${visitId})`)
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

          const responseData = await response.json()
          addLog(`API response: ${response.status} ${JSON.stringify(responseData)}`)

          if (!response.ok) {
            // APIエラーでもブロックしない - トラッキング連携失敗は致命的でない
            addLog(`WARNING: link-visit API failed but continuing: ${response.status}`)
          }
        } else {
          addLog('Skipped link-visit API (direct access)')
        }

        // 友だち追加状態チェック
        addLog('Checking friendship...')
        try {
          const friendship = await window.liff.getFriendship()
          addLog(`Friendship: ${friendship.friendFlag}`)

          if (friendship.friendFlag) {
            setStatus('success')
            setMessage(`${profile.displayName}さん、連携が完了しました！`)
            setTimeout(() => {
              if (window.liff.isInClient()) {
                window.liff.closeWindow()
              }
            }, 5000)
          } else {
            setStatus('friend-prompt')
            setMessage('友だち追加して利用開始！')
          }
        } catch (friendError) {
          // getFriendship は LINE Login チャネルでは動かない場合がある
          addLog(`getFriendship error (non-critical): ${friendError}`)
          setStatus('success')
          setMessage(`${profile.displayName}さん、連携が完了しました！`)
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error('LIFF error:', error)
        addLog(`FATAL ERROR: ${errMsg}`)
        setStatus('error')
        setMessage(errMsg)
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

          {status === 'error' && (
            <div>
              <p style={{ color: '#e74c3c', fontSize: '13px', margin: '0 0 16px', wordBreak: 'break-all' }}>
                {message}
              </p>
              {lineUrl && (
                <a
                  href={lineUrl}
                  style={{
                    display: 'inline-block',
                    background: '#06C755',
                    color: '#fff',
                    textDecoration: 'none',
                    fontSize: '14px',
                    padding: '10px 24px',
                    borderRadius: '8px',
                    fontWeight: 'bold'
                  }}
                >
                  LINE友だち追加へ進む
                </a>
              )}
            </div>
          )}

          {/* デバッグログ（エラー時のみ表示） */}
          {debugLog.length > 0 && status === 'error' && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              background: '#f0f0f0',
              borderRadius: '8px',
              textAlign: 'left',
              maxHeight: '200px',
              overflowY: 'auto'
            }}>
              <p style={{ color: '#666', fontSize: '11px', fontWeight: 'bold', margin: '0 0 6px' }}>
                Debug Log:
              </p>
              {debugLog.map((log, i) => (
                <p key={i} style={{ color: '#333', fontSize: '10px', margin: '2px 0', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {log}
                </p>
              ))}
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
