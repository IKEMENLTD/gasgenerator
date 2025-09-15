'use client'

/**
 * コード表示用クライアントコンポーネント
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

  // コピー機能
  const handleCopy = async () => {
    if (!initialData?.code) return

    try {
      await navigator.clipboard.writeText(initialData.code)
      setCopied(true)
      setCopyCount(prev => prev + 1)

      // コピー回数をサーバーに送信（非同期）
      fetch(`/api/share/${shareId}/copy`, { method: 'POST' }).catch(console.error)

      // 3秒後にコピー状態をリセット
      setTimeout(() => setCopied(false), 3000)
    } catch (error) {
      console.error('Failed to copy:', error)
      alert('コピーに失敗しました')
    }
  }

  // ダウンロード機能
  const handleDownload = () => {
    if (!initialData?.code) return

    const blob = new Blob([initialData.code], { type: 'text/javascript' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = initialData.fileName || 'code.gs'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!initialData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // 有効期限までの残り時間計算
  const expiresAt = new Date(initialData.expiresAt)
  const now = new Date()
  const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
              <h1 className="text-xl font-semibold text-gray-900">GAS Generator</h1>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg font-medium transition duration-200 ${
                  copied
                    ? 'bg-green-600 text-white'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {copied ? '✓ コピー完了' : '📋 コピー'}
              </button>
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition duration-200"
              >
                💾 ダウンロード
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* タイトルと説明 */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {initialData.title}
          </h2>
          {initialData.description && (
            <p className="text-gray-600 mb-4">{initialData.description}</p>
          )}

          {/* メタ情報 */}
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span>📅 作成: {new Date(initialData.createdAt).toLocaleDateString('ja-JP')}</span>
            <span>👀 閲覧: {initialData.viewCount}回</span>
            <span>📋 コピー: {copyCount}回</span>
            <span className={daysLeft <= 3 ? 'text-red-600 font-semibold' : ''}>
              ⏰ 有効期限: あと{daysLeft}日
            </span>
            {initialData.isPremium && (
              <span className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-2 py-1 rounded-full text-xs font-semibold">
                💎 Premium
              </span>
            )}
          </div>

          {/* タグ */}
          {initialData.tags && initialData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {initialData.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* コード表示エリア */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="bg-gray-800 text-gray-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-mono">{initialData.fileName}</span>
            <span className="text-xs text-gray-400">{initialData.language}</span>
          </div>
          <div className="relative">
            <pre className="p-4 bg-gray-900 text-gray-100 overflow-x-auto">
              <code className="text-sm font-mono whitespace-pre">
                {initialData.code}
              </code>
            </pre>
          </div>
        </div>

        {/* 使い方ガイド */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            📖 使い方
          </h3>
          <ol className="space-y-3 text-gray-700">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold mr-3">
                1
              </span>
              <div>
                <p className="font-medium">上のコードをコピー</p>
                <p className="text-sm text-gray-600 mt-1">
                  「コピー」ボタンをクリックしてコードをクリップボードにコピーします
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold mr-3">
                2
              </span>
              <div>
                <p className="font-medium">Google Apps Scriptを開く</p>
                <p className="text-sm text-gray-600 mt-1">
                  <a
                    href="https://script.google.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    script.google.com
                  </a>
                  にアクセスして新規プロジェクトを作成
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold mr-3">
                3
              </span>
              <div>
                <p className="font-medium">コードを貼り付けて保存</p>
                <p className="text-sm text-gray-600 mt-1">
                  エディタにコードを貼り付け、Ctrl+S（Mac: Cmd+S）で保存
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold mr-3">
                4
              </span>
              <div>
                <p className="font-medium">実行して権限を許可</p>
                <p className="text-sm text-gray-600 mt-1">
                  「実行」ボタンをクリックし、初回は権限の許可を行ってください
                </p>
              </div>
            </li>
          </ol>
        </div>

        {/* 関連コード */}
        {initialData.relatedCodes && initialData.relatedCodes.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              🔗 関連コード
            </h3>
            <div className="space-y-2">
              {initialData.relatedCodes.map((related) => (
                <a
                  key={related.id}
                  href={`/s/${related.shortId}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition duration-200"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{related.title}</span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                      {(related as any).relationType === 'parent' ? '元バージョン' :
                       (related as any).relationType === 'child' ? '修正版' : '関連'}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* フッター */}
        <div className="text-center text-sm text-gray-500 mt-8 pb-8">
          <p>
            このコードは{' '}
            <a
              href="https://line.me/R/ti/p/@YOUR_LINE_ID"
              className="text-blue-600 hover:underline"
            >
              GAS Generator
            </a>
            {' '}で自動生成されました
          </p>
        </div>
      </main>
    </div>
  )
}