'use client'

import { useState, useMemo, useCallback } from 'react'

// LINE公式アカウントのBasic ID（環境変数から取得、未設定の場合はTaskMateのデフォルト値）
const LINE_BOT_BASIC_ID = process.env.NEXT_PUBLIC_LINE_BOT_BASIC_ID || '356uysad'

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
    iframeAllowed: true,
  },
  {
    id: '03',
    name: '期限管理システム',
    tagline: '届出期限の一元管理・アラート通知',
    description: '届出期限を一元管理し、期限超過・今週期限・進行中・完了を可視化。顧客管理、届出マスタ管理、アラート通知機能を搭載。緊急度の高い案件を素早く確認できます。',
    tags: ['期限管理', 'アラート通知', '顧客管理', 'ダッシュボード'],
    previewUrl: 'https://kigenkannri.netlify.app/',
    iframeAllowed: true,
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
    iframeAllowed: true,
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
    iframeAllowed: true,
  },
  {
    id: '10',
    name: '離脱顧客掘り起こし',
    tagline: '休眠顧客を自動抽出・復帰キャンペーン',
    description: '3ヶ月以上来店のない顧客を自動抽出し、セグメント別（3ヶ月/6ヶ月/1年）に分類。復帰キャンペーンメールをワンクリックで一括送信。クーポン発行・使用状況追跡機能も搭載。',
    tags: ['離脱顧客', 'メール配信', 'クーポン管理', '顧客復帰'],
    previewUrl: 'https://ridatukokyaku.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '11',
    name: '有効期限管理（資格・免許）',
    tagline: '資格・免許の期限を一元管理・自動通知',
    description: '従業員の資格・免許の有効期限を一元管理。期限切れリスクを自動検出し、Slack・メールで通知。ダッシュボードで要対応リスト、リスクレポート、アラート履歴を確認。CSVエクスポート・印刷機能も搭載。',
    tags: ['資格管理', '免許管理', '期限通知', 'リスク管理'],
    previewUrl: 'https://yuukoukigennkannri.netlify.app/',
    iframeAllowed: true,
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
    iframeAllowed: true,
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
    iframeAllowed: true,
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
  {
    id: '21',
    name: 'ダブルブッキング防止（予約）',
    tagline: 'Web予約＋重複防止の自動チェック',
    description: 'Web予約システムにダブルブッキング防止機能を搭載。予約時にリアルタイムで空き状況を確認し、重複予約を自動でブロック。施設・人員・時間帯別の管理、キャンセル待ち機能も対応。',
    tags: ['予約管理', 'ダブルブッキング防止', '空き状況確認', 'キャンセル待ち'],
    previewUrl: 'https://doublebooking.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '22',
    name: '価格表・見積基準管理',
    tagline: '価格マスタ＋見積作成＋値引きルール',
    description: '価格マスタを一元管理し、見積書を自動生成。商品・サービス別の価格設定、数量・顧客ランク別の値引きルールを適用。見積履歴の管理、PDF出力、承認ワークフロー機能を搭載。',
    tags: ['価格管理', '見積作成', '値引きルール', 'PDF出力'],
    previewUrl: 'https://priselistandquotation.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '23',
    name: '議事録→タスク自動抽出',
    tagline: '議事録からTODOを自動抽出・リマインド',
    description: '議事録テキストからAIがタスクを自動抽出。担当者・期限を設定し、タスク一覧として管理。期限前リマインド、Slack・メール通知、進捗トラッキング機能で会議後のフォローを効率化。',
    tags: ['議事録管理', 'タスク抽出', 'リマインド', '進捗管理'],
    previewUrl: 'https://giziroku-taskauto.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '24',
    name: '勤怠集計→給与計算連携',
    tagline: '勤怠打刻・残業管理・給与計算の自動化',
    description: '勤怠打刻から給与計算までを一気通貫で管理。出退勤記録、残業・深夜・休日勤務の自動集計、36協定チェック機能を搭載。給与計算システムへのCSV出力で連携。部署別・従業員別の勤務実績をダッシュボードで可視化。',
    tags: ['勤怠管理', '給与計算', '残業管理', '36協定'],
    previewUrl: 'https://kintgaisyuukei-kyuuyo.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '25',
    name: '承認フロー強制',
    tagline: '申請→承認→実行の流れを可視化・強制',
    description: '「聞いてない」「誰が許可した？」を防ぐ承認フロー管理システム。申請→承認→実行の流れを強制し、承認履歴を完全記録。代理承認、一括承認、リマインド機能を搭載。監査ログでコンプライアンス対応も万全。',
    tags: ['承認フロー', 'ワークフロー', '監査ログ', 'コンプライアンス'],
    previewUrl: 'https://syouninn.netlify.app/',
    iframeAllowed: true,
  },
  {
    id: '26',
    name: '入金消込チェッカー',
    tagline: '請求と入金の自動マッチング・消込',
    description: '経理部門向けの入金消込管理ツール。請求データと入金データを自動突合し、振込名義からの取引先マッチング、振込手数料差額の自動処理を実行。督促前チェック、月次レポート、Slack・メール通知機能を搭載。',
    tags: ['入金消込', '請求管理', '自動マッチング', '督促管理'],
    previewUrl: 'https://nyukincheck.netlify.app/',
    iframeAllowed: true,
  },
]

export default function SystemCatalogPage() {
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>('01')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // ダウンロードメッセージをクリップボードにコピー
  const handleCopyDownloadMessage = useCallback(async (systemName: string) => {
    const message = `${systemName}をダウンロード`
    try {
      await navigator.clipboard.writeText(message)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      // フォールバック: 古いブラウザ用
      const textArea = document.createElement('textarea')
      textArea.value = message
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }, [])

  // 検索フィルタ
  const filteredSystems = useMemo(() => {
    if (!searchQuery.trim()) return systems
    const query = searchQuery.toLowerCase()
    return systems.filter(
      (system) =>
        system.name.toLowerCase().includes(query) ||
        system.tagline.toLowerCase().includes(query) ||
        system.tags.some((tag) => tag.toLowerCase().includes(query))
    )
  }, [searchQuery])

  // 選択中のシステム
  const selectedSystem = systems.find((s) => s.id === selectedSystemId)

  // システム選択ハンドラー
  const handleSelectSystem = (id: string) => {
    setSelectedSystemId(id)
    setIsSidebarOpen(false) // モバイルではサイドバーを閉じる
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          {/* モバイル用ハンバーガーボタン */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">システムカタログ</h1>
            <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">全{systems.length}システム</p>
          </div>
        </div>
        <div className="text-xs text-gray-400">
          {selectedSystem && (
            <span className="hidden sm:inline">
              選択中: <span className="text-cyan-600 font-medium">{selectedSystem.name}</span>
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* モバイル用オーバーレイ */}
        {isSidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-30"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* サイドバー */}
        <aside
          className={`
            fixed lg:static inset-y-0 left-0 z-40
            w-80 bg-white border-r border-gray-200
            transform transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            flex flex-col
          `}
        >
          {/* サイドバーヘッダー（モバイル用閉じるボタン） */}
          <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200">
            <span className="font-bold text-gray-900">システム一覧</span>
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 検索ボックス */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="システムを検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* システムリスト */}
          <nav className="flex-1 overflow-y-auto p-2">
            {filteredSystems.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                該当するシステムがありません
              </div>
            ) : (
              <div className="space-y-1">
                {filteredSystems.map((system) => (
                  <button
                    key={system.id}
                    onClick={() => handleSelectSystem(system.id)}
                    className={`
                      w-full text-left p-3 rounded-xl transition-all duration-200
                      ${
                        selectedSystemId === system.id
                          ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30'
                          : 'hover:bg-gray-100 text-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={`
                          text-xs font-bold px-2 py-1 rounded-md flex-shrink-0
                          ${selectedSystemId === system.id ? 'bg-white/20 text-white' : 'bg-cyan-100 text-cyan-700'}
                        `}
                      >
                        {system.id}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`font-medium text-sm truncate ${selectedSystemId === system.id ? 'text-white' : 'text-gray-900'}`}>
                          {system.name}
                        </div>
                        <div className={`text-xs truncate mt-0.5 ${selectedSystemId === system.id ? 'text-white/80' : 'text-gray-500'}`}>
                          {system.tagline}
                        </div>
                      </div>
                      {!system.iframeAllowed && (
                        <svg
                          className={`w-4 h-4 flex-shrink-0 ${selectedSystemId === system.id ? 'text-white/60' : 'text-gray-400'}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </nav>

          {/* サイドバーフッター */}
          <div className="p-3 border-t border-gray-100 bg-gray-50">
            <div className="text-xs text-gray-500 text-center">
              <svg className="w-4 h-4 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              = 外部リンク（プレビュー不可）
            </div>
          </div>
        </aside>

        {/* メインコンテンツエリア */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {selectedSystem ? (
            <>
              {/* プレビューエリア */}
              <div className="flex-1 bg-gray-100 p-2 sm:p-4 overflow-hidden">
                {selectedSystem.iframeAllowed ? (
                  <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    {/* URLバー */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      </div>
                      <div className="flex-1 flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-gray-200 text-xs text-gray-500 overflow-hidden">
                        <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                        </svg>
                        <span className="truncate">{selectedSystem.previewUrl}</span>
                      </div>
                      <a
                        href={selectedSystem.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-lg transition-colors"
                      >
                        <span className="hidden sm:inline">新しいタブ</span>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                    {/* iframe */}
                    <iframe
                      src={selectedSystem.previewUrl}
                      className="flex-1 w-full"
                      title={`${selectedSystem.name} プレビュー`}
                      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    />
                  </div>
                ) : (
                  /* iframe非対応の場合 */
                  <div className="h-full bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">埋め込みプレビュー不可</h3>
                    <p className="text-gray-500 text-sm mb-6 max-w-md">
                      このシステムはセキュリティ設定により、埋め込み表示ができません。<br />
                      新しいタブで直接開いてご確認ください。
                    </p>
                    <a
                      href={selectedSystem.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white font-medium rounded-xl hover:bg-cyan-600 transition-colors shadow-lg shadow-cyan-500/30"
                    >
                      <span>サイトを開く</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              {/* システム情報パネル */}
              <div className="bg-white border-t border-gray-200 px-4 py-4 flex-shrink-0">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-cyan-500 font-bold text-sm">{selectedSystem.id}</span>
                      <h2 className="text-lg font-bold text-gray-900 truncate">{selectedSystem.name}</h2>
                    </div>
                    <p className="text-cyan-600 text-sm font-medium mb-2">{selectedSystem.tagline}</p>
                    <p className="text-gray-600 text-sm line-clamp-2 hidden sm:block">{selectedSystem.description}</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-shrink-0">
                    {/* LINEでダウンロードボタン */}
                    <div className="flex flex-col gap-2">
                      <a
                        href={`https://line.me/R/oaMessage/@${LINE_BOT_BASIC_ID}/?${encodeURIComponent(selectedSystem.name + 'をダウンロード')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#06C755] hover:bg-[#05b04c] text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-green-500/30"
                      >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
                        </svg>
                        LINEでダウンロード
                      </a>
                      <button
                        onClick={() => handleCopyDownloadMessage(selectedSystem.name)}
                        className={`inline-flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-lg transition-colors ${
                          copySuccess
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                        }`}
                      >
                        {copySuccess ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            コピーしました
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                            メッセージをコピー
                          </>
                        )}
                      </button>
                    </div>
                    {/* タグ */}
                    <div className="flex flex-wrap gap-1.5 sm:max-w-xs">
                      {selectedSystem.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full whitespace-nowrap"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* システム未選択時 */
            <div className="flex-1 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <p className="text-gray-500 text-lg">左のリストからシステムを選択してください</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
