'use client'

import { useState } from 'react'

// システムデータ
const systems = [
  {
    id: '01',
    name: '営業日報システム',
    tagline: '日報入力・週報月報自動生成',
    description: 'Netlify + GAS構成の営業日報管理システム。Soft UIデザインでスマホ対応。週報・月報を自動生成し、チーム全体の営業活動を可視化します。',
    tags: ['日報管理', '自動集計', 'GAS連携', 'Soft UI'],
    previewUrl: 'https://eigyonippou.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '02',
    name: '失客アラートシステム',
    tagline: '顧客の失客リスクを自動検知・通知',
    description: '顧客の来店間隔を分析し、失客リスクのある顧客を自動検出して通知。顧客ランク別の閾値設定で、VIP顧客は早めにアラート。毎日9時に自動チェック。',
    tags: ['失客検知', '自動通知', '顧客管理', 'リスク分析'],
    previewUrl: 'https://jovial-starship-2e968e.netlify.app',
    iframeAllowed: false, // X-Frame-Options: DENY のため
  },
]

export default function SystemCatalogPage() {
  const [openSystemId, setOpenSystemId] = useState<string | null>(null)

  const togglePreview = (id: string) => {
    setOpenSystemId(openSystemId === id ? null : id)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">システムカタログ</h1>
          <p className="text-gray-600 mt-1">各システムをプレビューで実際に触れます</p>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {systems.map((system) => (
            <div
              key={system.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300"
            >
              {/* カードヘッダー */}
              <div className="p-4 sm:p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex-1">
                    {/* 番号 + 名前 */}
                    <div className="flex items-center gap-2 sm:gap-3 mb-2">
                      <span className="text-cyan-500 font-bold text-base sm:text-lg">{system.id}</span>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-900">{system.name}</h2>
                    </div>

                    {/* キャッチコピー */}
                    <p className="text-cyan-600 font-medium text-sm sm:text-base mb-2 sm:mb-3">{system.tagline}</p>

                    {/* 説明文 */}
                    <p className="text-gray-600 text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4">
                      {system.description}
                    </p>

                    {/* タグ */}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 mb-4">
                      {system.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 sm:px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* ボタンエリア（モバイルでは全幅） */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* iframe対応サイトはOPEN PREVIEWボタン */}
                    {system.iframeAllowed ? (
                      <button
                        onClick={() => togglePreview(system.id)}
                        className={`w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-full font-medium text-sm transition-all ${
                          openSystemId === system.id
                            ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            : 'bg-cyan-500 text-white hover:bg-cyan-600'
                        }`}
                      >
                        {openSystemId === system.id ? (
                          <>
                            <span>CLOSE PREVIEW</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                            </svg>
                          </>
                        ) : (
                          <>
                            <span>OPEN PREVIEW</span>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                    ) : (
                      /* iframe非対応サイトは外部リンクボタン */
                      <a
                        href={system.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2 rounded-full font-medium text-sm bg-cyan-500 text-white hover:bg-cyan-600 transition-all"
                      >
                        <span>サイトを開く</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* プレビュー部分（iframe対応サイト＆展開時のみ表示） */}
              {system.iframeAllowed && openSystemId === system.id && (
                <div className="border-t border-gray-200 bg-gray-50 p-3 sm:p-4">
                  {/* URL表示バー */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 sm:mb-4 bg-white rounded-lg px-3 sm:px-4 py-2 border border-gray-200">
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 overflow-hidden">
                      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span className="truncate">{system.previewUrl}</span>
                    </div>
                    <a
                      href={system.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-cyan-600 hover:text-cyan-700 text-xs sm:text-sm font-medium whitespace-nowrap"
                    >
                      新しいタブで開く →
                    </a>
                  </div>

                  {/* iframe プレビュー */}
                  <div className="rounded-lg overflow-hidden border border-gray-200 bg-white">
                    <iframe
                      src={system.previewUrl}
                      className="w-full h-[400px] sm:h-[500px] md:h-[600px]"
                      title={`${system.name} プレビュー`}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* フッター */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 text-sm">
            各システムについて質問がある場合は、LINEで「○○について教えて」と聞いてください
          </p>
        </div>
      </main>
    </div>
  )
}
