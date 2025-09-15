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
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Secure Share
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl overflow-hidden">
          {/* タイトルセクション */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-8 text-white relative overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,.1) 10px, rgba(255,255,255,.1) 20px)`
              }} />
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                <span className="text-sm font-medium text-blue-100">AI Generated Code</span>
              </div>

              <h1 className="text-3xl font-bold mb-3">{initialData.title}</h1>
              <p className="text-blue-50 text-base leading-relaxed mb-6">
                {initialData.description || 'カスタマイズされたGoogle Apps Scriptコード'}
              </p>

              {/* 統計情報 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <div>
                      <p className="text-2xl font-bold">{initialData.viewCount || 0}</p>
                      <p className="text-xs text-blue-100">Views</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-2xl font-bold">{copyCount}</p>
                      <p className="text-xs text-blue-100">Copies</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold">{new Date(initialData.createdAt).toLocaleDateString('ja-JP')}</p>
                      <p className="text-xs text-blue-100">Created</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <div>
                      <p className="text-sm font-semibold">{lineCount} lines</p>
                      <p className="text-xs text-blue-100">Code Size</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCopy}
                className={`px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 flex items-center gap-2 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700'
                }`}
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    コピー完了！
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    コードをコピー
                  </>
                )}
              </button>

              <a
                href="https://script.google.com/home"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 rounded-lg font-medium bg-white border border-gray-300 hover:bg-blue-50 transition-all transform hover:scale-105 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Apps Scriptで開く
              </a>

              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-6 py-3 rounded-lg font-medium bg-white border border-gray-300 hover:bg-purple-50 transition-all transform hover:scale-105 flex items-center gap-2 disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    ダウンロード中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    ファイル保存
                  </>
                )}
              </button>

              {shouldTruncate && (
                <button
                  onClick={() => setShowFullCode(!showFullCode)}
                  className="px-6 py-3 rounded-lg font-medium bg-white border border-gray-300 hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  {showFullCode ? 'コードを折りたたむ' : 'すべて表示'}
                </button>
              )}
            </div>
          </div>

          {/* コード表示エリア */}
          <div className="p-6">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl blur opacity-20" />
              <div className="relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-4 py-3 flex items-center justify-between border-b border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500 animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                      </svg>
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
                  <pre className="p-6 overflow-x-auto bg-gradient-to-br from-gray-900 to-gray-950">
                    <code className="text-sm text-gray-100 font-mono leading-relaxed">
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
          </div>

          {/* 使用方法と特徴 */}
          <div className="p-6 pt-0">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <div className="p-1 bg-blue-600 rounded-lg">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  使用方法
                </h3>
                <ol className="space-y-2 text-sm text-blue-800">
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 mt-0.5">1.</span>
                    <span>上記のコードをコピーボタンでコピー</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 mt-0.5">2.</span>
                    <span>「Apps Scriptで開く」ボタンをクリック</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 mt-0.5">3.</span>
                    <span>既存コードを削除してペースト</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold text-blue-600 mt-0.5">4.</span>
                    <span>保存して実行（初回は承認が必要）</span>
                  </li>
                </ol>
              </div>

              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-5 border border-purple-200">
                <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                  <div className="p-1 bg-purple-600 rounded-lg">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </div>
                  特徴
                </h3>
                <ul className="space-y-2 text-sm text-purple-800">
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span>AI が要件に合わせて自動生成</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span>エラーハンドリング実装済み</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
                    <span>Google 公式 API に準拠</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-purple-600 mt-1">✓</span>
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
                    className="px-4 py-2 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 rounded-full text-sm font-medium hover:shadow-md transition-shadow"
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