'use client'

import { useState } from 'react'
import type { GetCodeShareResponse } from '@/types/code-share'
import './code-viewer.css'
import './print-fix.css'

interface CodeViewerProps {
  shareId: string
  initialData: GetCodeShareResponse['data']
}

export default function CodeViewer({ shareId, initialData }: CodeViewerProps) {
  const [copied, setCopied] = useState(false)
  const [showFullCode, setShowFullCode] = useState(false)

  const handleCopy = async () => {
    if (!initialData?.code) return

    try {
      await navigator.clipboard.writeText(initialData.code)
      setCopied(true)
      fetch(`/api/share/${shareId}/copy`, { method: 'POST' }).catch(console.error)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Copy failed:', error)
    }
  }

  const handleDownload = () => {
    if (!initialData?.code) return

    const blob = new Blob([initialData.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${initialData.title.replace(/\s+/g, '-').toLowerCase()}.gs`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (!initialData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-700 mb-2">コードが見つかりません</h1>
          <p className="text-gray-500">URLをご確認ください</p>
        </div>
      </div>
    )
  }

  const lineCount = initialData.code.split('\n').length
  const shouldTruncate = initialData.code.length > 2000
  const displayCode = showFullCode || !shouldTruncate
    ? initialData.code
    : initialData.code.substring(0, 2000) + '\n\n// ... さらに表示するには「すべて表示」をクリック'

  return (
    <div className="min-h-screen">
      {/* ヘッダー */}
      <header className="glass-header">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">GAS Code Generator</h1>
              <p className="text-xs text-gray-500 hidden sm:block">Google Apps Script 自動生成</p>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="max-w-5xl mx-auto py-6 sm:py-8">
        <div className="main-card animate-fadeIn">

          {/* タイトルセクション */}
          <div className="card-header">
            <h1>{initialData.title}</h1>
            <p>{initialData.description || 'カスタムGoogle Apps Scriptコード'}</p>
          </div>

          {/* 統計情報 */}
          <div className="stats-bar">
            <div className="stat-item">
              <span className="stat-label">閲覧数</span>
              <span className="stat-value">{initialData.viewCount || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">コピー数</span>
              <span className="stat-value">{initialData.copyCount || 0}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">行数</span>
              <span className="stat-value">{lineCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">作成日</span>
              <span className="stat-value" style={{fontSize: '1rem'}}>
                {new Date(initialData.createdAt).toLocaleDateString('ja-JP')}
              </span>
            </div>
          </div>

          {/* アクションボタン */}
          <div className="action-bar">
            <button
              onClick={handleCopy}
              className={`btn ${copied ? 'btn-success' : 'btn-primary'}`}
            >
              {copied ? 'コピー完了' : 'コードをコピー'}
            </button>

            <a
              href="https://script.google.com/home"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary"
            >
              Apps Scriptで開く
            </a>

            <button onClick={handleDownload} className="btn btn-secondary">
              ダウンロード
            </button>

            {shouldTruncate && (
              <button
                onClick={() => setShowFullCode(!showFullCode)}
                className="btn btn-secondary"
              >
                {showFullCode ? '折りたたむ' : 'すべて表示'}
              </button>
            )}
          </div>

          {/* コード表示 */}
          <div className="code-section">
            <div className="code-container">
              <div className="code-header">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm font-mono">code.gs</span>
                    <span className="text-gray-600 text-xs">•</span>
                    <span className="code-lang">JavaScript</span>
                  </div>
                  <span className="text-gray-500 text-xs font-mono">{lineCount} lines</span>
                </div>
              </div>
              <pre className="code-content">
                <code>{displayCode}</code>
              </pre>
            </div>
          </div>

          {/* 使用方法 */}
          <div className="guide-section">
            <div className="guide-card">
              <h3>設定手順</h3>
              <ol className="step-list">
                <li className="step-item">
                  <span className="step-number">1</span>
                  <span className="step-text">上記の「コードをコピー」ボタンをクリック</span>
                </li>
                <li className="step-item">
                  <span className="step-number">2</span>
                  <span className="step-text">「Apps Scriptで開く」をクリックして新規プロジェクトを作成</span>
                </li>
                <li className="step-item">
                  <span className="step-number">3</span>
                  <span className="step-text">既存のコードを全て削除してペースト</span>
                </li>
                <li className="step-item">
                  <span className="step-number">4</span>
                  <span className="step-text">Ctrl+S（Mac: Cmd+S）で保存して実行</span>
                </li>
              </ol>
            </div>

            <div className="guide-card">
              <h3>特徴</h3>
              <ul className="step-list">
                <li className="step-item">
                  <span className="step-text">AIが要件に合わせて自動生成</span>
                </li>
                <li className="step-item">
                  <span className="step-text">エラーハンドリング実装済み</span>
                </li>
                <li className="step-item">
                  <span className="step-text">Google公式APIに準拠</span>
                </li>
                <li className="step-item">
                  <span className="step-text">すぐに使える実用的なコード</span>
                </li>
              </ul>
            </div>
          </div>

          {/* タグ */}
          {initialData.tags && initialData.tags.length > 0 && (
            <div className="tags-section">
              {initialData.tags.map((tag, index) => (
                <span key={index} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* フッター */}
        <footer className="footer">
          <p>Generated by Task mate AI</p>
          <p className="mt-1">© 2025 All rights reserved</p>
        </footer>
      </div>
    </div>
  )
}