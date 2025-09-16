'use client'

/**
 * コード表示用クライアントコンポーネント
 * 美しいデザインテンプレート実装
 */

import { useState } from 'react'
import type { GetCodeShareResponse } from '@/types/code-share'

interface CodeViewerProps {
  shareId: string
  initialData: GetCodeShareResponse['data']
}

export default function CodeViewer({ shareId, initialData }: CodeViewerProps) {
  const [copied, setCopied] = useState(false)
  const [copyCount, setCopyCount] = useState(initialData?.copyCount || 0)
  const [showFullCode, setShowFullCode] = useState(false)
  const [downloading, setDownloading] = useState(false)

  // コピー機能
  const handleCopy = async () => {
    if (!initialData?.code) return

    try {
      await navigator.clipboard.writeText(initialData.code)
      setCopied(true)
      setCopyCount(prev => prev + 1)

      // コピー回数をサーバーに送信（非同期）
      fetch(`/api/share/${shareId}/copy`, { method: 'POST' }).catch(console.error)

      // 2秒後にリセット
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  // ダウンロード機能
  const handleDownload = () => {
    if (!initialData?.code) return

    setDownloading(true)
    const blob = new Blob([initialData.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `code-${shareId}.gs`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setTimeout(() => setDownloading(false), 1000)
  }

  if (!initialData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-700 mb-2">コードが見つかりません</h1>
          <p className="text-gray-500">URLをご確認ください</p>
        </div>
      </div>
    )
  }

  const codeLength = initialData.code.length
  const lineCount = initialData.code.split('\n').length
  const shouldTruncate = codeLength > 1000

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* ヘッダー */}
      <header className="glass sticky top-0 z-10 no-print">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="feature-icon bg-gradient-to-br from-blue-500 to-purple-600">
                <svg className="icon text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  GAS Code Share
                </h1>
                <p className="text-xs text-gray-500">Google Apps Script Generator</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="tag flex items-center gap-1">
                <svg className="icon-sm text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <span>Secure Share</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="premium-card animate-fadeIn">
          {/* タイトルセクション */}
          <div className="gradient-header">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px)`
              }} />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <span className="emoji">⭐</span>
                <span className="text-sm font-medium text-blue-100">AI Generated Code</span>
              </div>

              <h1 className="text-3xl font-bold mb-3">{initialData.title}</h1>
              <p className="text-blue-50 text-base leading-relaxed mb-6">
                {initialData.description || 'カスタマイズされたGoogle Apps Scriptコード'}
              </p>

              {/* 統計情報 */}
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-value">{initialData.viewCount || 0}</div>
                  <div className="stat-label">👁️ Views</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{copyCount}</div>
                  <div className="stat-label">📋 Copies</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value" style={{fontSize: '1rem'}}>{new Date(initialData.createdAt).toLocaleDateString('ja-JP')}</div>
                  <div className="stat-label">📅 Created</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{lineCount}</div>
                  <div className="stat-label">💻 Lines</div>
                </div>
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopy}
                className={`btn ${
                  copied ? 'btn-success' : 'btn-primary'
                }`}
              >
                {copied ? (
                  <>
                    <span className="emoji">✅</span>
                    コピー完了！
                  </>
                ) : (
                  <>
                    <span className="emoji">📋</span>
                    コードをコピー
                  </>
                )}
              </button>

              <a
                href="https://script.google.com/home"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
              >
                <span className="emoji">🚀</span>
                Apps Scriptで開く
              </a>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn btn-secondary disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <span className="emoji animate-pulse">⏳</span>
                    ダウンロード中...
                  </>
                ) : (
                  <>
                    <span className="emoji">💾</span>
                    ファイル保存
                  </>
                )}
              </button>

              {shouldTruncate && (
                <button
                  onClick={() => setShowFullCode(!showFullCode)}
                  className="btn btn-secondary"
                >
                  <span className="emoji">👁️</span>
                  {showFullCode ? 'コードを折りたたむ' : 'すべて表示'}
                </button>
              )}
            </div>
          </div>

          {/* コード表示エリア */}
          <div className="p-6">
            <div className="code-container">
                <div className="code-header">
                  <div className="flex items-center gap-3">
                    <div className="code-dots">
                      <div className="code-dot red" />
                      <div className="code-dot yellow" />
                      <div className="code-dot green" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="emoji">📝</span>
                      <span className="text-gray-300 text-sm font-mono">code.gs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="px-2 py-1 bg-blue-500/20 rounded-md">
                      <span className="text-xs font-mono text-blue-400">JavaScript</span>
                    </div>
                    <div className="text-xs text-gray-500 font-mono">{lineCount} lines</div>
                  </div>
                </div>
                <div className="relative">
                  <pre className="code-content">
                    <code>
                      {showFullCode || !shouldTruncate
                        ? initialData.code
                        : initialData.code.substring(0, 1000) + '\n\n// ... (続きがあります。「すべて表示」をクリックして全体を確認)'}
                    </code>
                  </pre>
                  {!showFullCode && shouldTruncate && (
                    <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-900 to-transparent pointer-events-none" />
                  )}
                </div>
            </div>
          </div>

          {/* 使用方法と特徴 */}
          <div className="p-6 pt-0">
            <div className="feature-grid">
              <div className="feature-card">
                <div className="feature-icon">
                  <span className="emoji">✅</span>
                </div>
                <h3 className="feature-title">使用方法</h3>
                <ol className="feature-description space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="font-bold mt-0.5">1.</span>
                    <span>上記のコードをコピーボタンでコピー</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold mt-0.5">2.</span>
                    <span>「Apps Scriptで開く」ボタンをクリック</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold mt-0.5">3.</span>
                    <span>既存コードを削除してペースト</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold mt-0.5">4.</span>
                    <span>保存して実行（初回は承認が必要）</span>
                  </li>
                </ol>
              </div>

              <div className="feature-card" style={{background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'}}>
                <div className="feature-icon">
                  <span className="emoji">⭐</span>
                </div>
                <h3 className="feature-title">特徴</h3>
                <ul className="feature-description space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="emoji mt-1">✓</span>
                    <span>AI が要件に合わせて自動生成</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="emoji mt-1">✓</span>
                    <span>エラーハンドリング実装済み</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="emoji mt-1">✓</span>
                    <span>Google 公式 API に準拠</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="emoji mt-1">✓</span>
                    <span>すぐに使える実用的なコード</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* タグ */}
          {initialData.tags && initialData.tags.length > 0 && (
            <div className="px-6 pb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-3">カテゴリータグ</h3>
              <div className="flex flex-wrap gap-2">
                {initialData.tags.map((tag, index) => (
                  <span
                    key={index}
                    className="tag"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <footer className="mt-8 text-center text-sm text-gray-500">
          <p>Generated by GAS Generator AI</p>
          <p className="mt-1">© 2025 All rights reserved</p>
        </footer>
      </div>
    </div>
  )
}