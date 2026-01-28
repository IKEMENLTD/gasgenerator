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
    iframeAllowed: false,
  },
  {
    id: '03',
    name: '期限管理システム',
    tagline: '届出期限の一元管理・アラート通知',
    description: '届出期限を一元管理し、期限超過・今週期限・進行中・完了を可視化。顧客管理、届出マスタ管理、アラート通知機能を搭載。緊急度の高い案件を素早く確認できます。',
    tags: ['期限管理', 'アラート通知', '顧客管理', 'ダッシュボード'],
    previewUrl: 'https://kigenkannri.netlify.app/',
    iframeAllowed: false,
  },
  {
    id: '04',
    name: 'リピート促進メールシステム',
    tagline: '来店後フォローアップの自動化',
    description: '来店後のフォローアップを自動化し、リピート率向上を支援。来店後○日経過した顧客に自動でフォローメールを送信。毎日9時に自動実行されます。',
    tags: ['リピート促進', '自動メール', '顧客フォロー', 'テンプレート管理'],
    previewUrl: 'https://ripi-tosokushinzidoumail.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '05',
    name: '口コミ依頼自動化システム',
    tagline: '口コミ依頼の自動送信・管理',
    description: '来店後の顧客に口コミ依頼を自動送信。口コミ依頼のタイミングや文面をカスタマイズ可能。口コミ獲得率の向上をサポートします。',
    tags: ['口コミ依頼', '自動送信', '顧客管理', 'レビュー促進'],
    previewUrl: 'https://kutikomizidouka.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '06',
    name: '客単価分析＋アップセル提案',
    tagline: '購買データ分析・提案自動生成',
    description: '購買データから同時購入パターンを分析し、アップセル・クロスセル提案を自動生成。商品別・カテゴリ別の売上分析、提案の効果測定機能を搭載。',
    tags: ['客単価分析', 'アップセル', 'クロスセル', '購買分析'],
    previewUrl: 'https://upsell-teiann.netlify.app/',
    iframeAllowed: false,
  },
  {
    id: '07',
    name: '納期アラートシステム',
    tagline: '案件の納期を一元管理・アラート通知',
    description: '案件の納期を一元管理し、超過・緊急案件を自動検出。ダッシュボードで進行中案件、超過案件、今週納期、今月完了を一目で確認。優先度別のリスト表示で見落としを防止します。',
    tags: ['納期管理', 'アラート通知', '案件管理', 'ダッシュボード'],
    previewUrl: '/demos/nouki-alert/index.html',
    iframeAllowed: true,
  },
  {
    id: '08',
    name: '必須タスクチェックリスト',
    tagline: 'テンプレートから漏れなくタスク管理',
    description: '業務テンプレートから自動でチェックリストを生成。タスクの進捗状況を可視化し、担当者別・期限別に管理。完了率や期限超過率を統計表示し、業務の抜け漏れを防止します。',
    tags: ['タスク管理', 'チェックリスト', 'テンプレート', '進捗管理'],
    previewUrl: '/demos/task-checklist/index.html',
    iframeAllowed: true,
  },
  {
    id: '09',
    name: 'LTV（顧客生涯価値）計算',
    tagline: '顧客ランク別管理・特典自動設定',
    description: '顧客の累計購入額からLTVを自動計算し、S/A/B/Cランクに分類。ランク別の特典（毎回10%OFF、ポイント2倍など）を自動設定。上位顧客リスト、ランク分布をダッシュボードで確認できます。',
    tags: ['LTV計算', '顧客ランク', '特典管理', '売上分析'],
    previewUrl: 'https://ltv-kokyakukannri.netlify.app/',
    iframeAllowed: false,
  },
  {
    id: '10',
    name: '離脱顧客掘り起こし',
    tagline: '休眠顧客を自動抽出・復帰キャンペーン',
    description: '3ヶ月以上来店のない顧客を自動抽出し、セグメント別（3ヶ月/6ヶ月/1年）に分類。復帰キャンペーンメールをワンクリックで一括送信。クーポン発行・使用状況追跡機能も搭載。',
    tags: ['離脱顧客', 'メール配信', 'クーポン管理', '顧客復帰'],
    previewUrl: 'https://ridatukokyaku.netlify.app/',
    iframeAllowed: false,
  },
  {
    id: '11',
    name: '有効期限管理（資格・免許）',
    tagline: '資格・免許の期限を一元管理・自動通知',
    description: '従業員の資格・免許の有効期限を一元管理。期限切れリスクを自動検出し、Slack・メールで通知。ダッシュボードで要対応リスト、リスクレポート、アラート履歴を確認。CSVエクスポート・印刷機能も搭載。',
    tags: ['資格管理', '免許管理', '期限通知', 'リスク管理'],
    previewUrl: 'https://yuukoukigennkannri.netlify.app/',
    iframeAllowed: false,
  },
  {
    id: '12',
    name: '紹介プログラム完全管理',
    tagline: '紹介キャンペーンの一元管理・効果測定',
    description: '紹介プログラムを完全管理。紹介者・被紹介者の追跡、特典付与状況の管理、紹介効果の分析機能を搭載。紹介経由の売上貢献を可視化し、プログラムの最適化をサポートします。',
    tags: ['紹介管理', 'キャンペーン', '特典管理', '効果測定'],
    previewUrl: 'https://syoukaipuroguramu.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '13',
    name: '価格テストA/B管理',
    tagline: '価格A/Bテストの計画・実行・分析',
    description: 'EC・小売業向けの価格テスト管理ツール。商品マスタ、価格変更履歴、A/Bテスト計画・分析、価格弾力性分析、競合価格トラッキング機能を搭載。週次レポートをSlack・メールで自動送信。',
    tags: ['A/Bテスト', '価格最適化', '売上分析', '競合分析'],
    previewUrl: 'https://prise-a-b.netlify.app/',
    iframeAllowed: false,
  },
  {
    id: '14',
    name: 'キャンペーン効果測定',
    tagline: 'ROAS・ROI・CVを自動計算・可視化',
    description: 'マーケティングキャンペーンの効果を自動測定。コスト・流入データ・CVを登録し、ROAS・ROI・CPA・CVRを自動計算。チャネル別・月次・目的別の分析、施策比較マトリクスでPDCAを支援。',
    tags: ['効果測定', 'ROAS', 'ROI', 'マーケティング'],
    previewUrl: 'https://tubular-cucurucho-861ee7.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '15',
    name: 'Webアプリ開発マニュアル',
    tagline: 'GAS開発の学習リソース・ドキュメント',
    description: 'プログラミング初心者向けのGAS（Google Apps Script）Webシステム開発マニュアル。スプレッドシート連携、API構築、Netlifyデプロイの手順を体系的に解説。インターン生の学習用リソース。',
    tags: ['開発マニュアル', 'GAS学習', 'チュートリアル', 'ドキュメント'],
    previewUrl: 'https://gasdevelop.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '16',
    name: '経費精算ワークフロー',
    tagline: '経費申請・承認・精算の一元管理',
    description: '経費申請から承認、精算までのワークフローを一元管理。申請者・承認者別の画面、部署別・科目別の集計ダッシュボード、領収書画像のアップロード機能を搭載。未承認アラートで承認漏れを防止。',
    tags: ['経費精算', 'ワークフロー', '承認管理', '集計レポート'],
    previewUrl: '/demos/expense-workflow/index.html',
    iframeAllowed: true,
  },
  {
    id: '17',
    name: '請求書自動生成＋送付',
    tagline: 'BtoB向け請求書管理・自動送付',
    description: 'BtoB事業者向けの請求書管理システム。取引先・契約情報から請求書を自動生成、PDF化してメール送付。月額契約の自動請求、入金管理、督促送信機能を搭載。毎月1日に自動で請求書を生成します。',
    tags: ['請求書', '自動生成', 'PDF送付', '入金管理'],
    previewUrl: 'https://seikyusyokannri.netlify.app/',
    iframeAllowed: false,
  },
  {
    id: '18',
    name: '売上日報自動集計',
    tagline: '日次・週次・月次の売上レポート自動化',
    description: '日々の売上データをスプレッドシートに入力するだけで、週次・月次レポートを自動生成。客単価、曜日別分析、前年同月比較をダッシュボードで可視化。ニューモーフィズムデザインのモダンなUI。',
    tags: ['売上集計', '日報管理', 'レポート自動化', 'ダッシュボード'],
    previewUrl: 'https://nippoukannri.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '19',
    name: '契約更新リマインド',
    tagline: '契約期限の一元管理・更新通知',
    description: '契約の更新期限を一元管理。期限が近い契約をダッシュボードで一覧表示し、更新漏れを防止。契約登録、検索・フィルタ機能、期限別アラートを搭載。サブスク契約や保守契約の管理に最適。',
    tags: ['契約管理', '更新通知', 'リマインド', '期限管理'],
    previewUrl: 'https://keiyakukousin.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '20',
    name: '定例MTGアジェンダ自動収集',
    tagline: '議題収集・アジェンダ配信の自動化',
    description: '定例ミーティングの議題をWebフォームから収集し、アジェンダを自動生成・配信。議題種別（共有/相談/決定/ブレスト）、希望時間、優先度を設定可能。毎日自動で収集開始・リマインド送信。',
    tags: ['MTG管理', 'アジェンダ', '議題収集', '自動配信'],
    previewUrl: '/demos/mtg-agenda/index.html',
    iframeAllowed: true,
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
