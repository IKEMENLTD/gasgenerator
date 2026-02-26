'use client'

import { useState, useMemo, useEffect } from 'react'

// 認証状態の型
interface AuthState {
  loading: boolean
  authenticated: boolean
  isPaid: boolean
  planName: string
  // URL認証パラメータ保持（ダウンロードURLに使用）
  authParams: string
  // ダウンロード回数制限
  downloadsRemaining: number
  downloadsLimit: number
  // 無料初回DL可能フラグ
  freeDownloadAvailable: boolean
}

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
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1yeys-GTCkYXvpWHSaBSvCjknsFcY5TmSx6-r-q_Aaxw/edit?gid=616392511#gid=616392511',
    manualUrl: 'https://drive.google.com/file/d/1QaIyutvZOSkJzMdxCGug2Abz5OCB0ZnQ/view?usp=drive_link',
  },
  {
    id: '02',
    name: '失客アラートシステム',
    tagline: '顧客の失客リスクを自動検知・通知',
    description: '顧客の来店間隔を分析し、失客リスクのある顧客を自動検出して通知。顧客ランク別の閾値設定で、VIP顧客は早めにアラート。毎日9時に自動チェック。',
    tags: ['失客検知', '自動通知', '顧客管理', 'リスク分析'],
    previewUrl: 'https://jovial-starship-2e968e.netlify.app',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1AEcS-LktDotRlM4uDflSfHatPn_jqJHBB7blSq5tKYk/edit?gid=584518683#gid=584518683',
    manualUrl: 'https://drive.google.com/file/d/193WS8ZjqtX8Vm_uTNWYYMtW3Pp8iRdvh/view?usp=drive_link',
  },
  {
    id: '03',
    name: '期限管理システム',
    tagline: '届出期限の一元管理・アラート通知',
    description: '届出期限を一元管理し、期限超過・今週期限・進行中・完了を可視化。顧客管理、届出マスタ管理、アラート通知機能を搭載。緊急度の高い案件を素早く確認できます。',
    tags: ['期限管理', 'アラート通知', '顧客管理', 'ダッシュボード'],
    previewUrl: 'https://kigenkannri.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1ZhTAYfu1jdceDk4Qozvxbff4XRS0EbkQ53276SSaexw/edit?gid=1843148959#gid=1843148959',
    manualUrl: 'https://drive.google.com/file/d/1SwBfPNHP9bsOnqGZBc9C03-UbmlTyvhh/view?usp=drive_link',
  },
  {
    id: '04',
    name: 'リピート促進メールシステム',
    tagline: '来店後フォローアップの自動化',
    description: '来店後のフォローアップを自動化し、リピート率向上を支援。来店後○日経過した顧客に自動でフォローメールを送信。毎日9時に自動実行されます。',
    tags: ['リピート促進', '自動メール', '顧客フォロー', 'テンプレート管理'],
    previewUrl: 'https://ripi-tosokushinzidoumail.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1RZCDCFeXin0AXievOao8DBbO9xNaezFNIJJdtEKB13c/edit?gid=0#gid=0',
    manualUrl: 'https://drive.google.com/file/d/10ZnJP2MmQqskY4ccxouz71Iy51AuHvtj/view?usp=drive_link',
  },
  {
    id: '05',
    name: '口コミ依頼自動化システム',
    tagline: '口コミ依頼の自動送信・管理',
    description: '来店後の顧客に口コミ依頼を自動送信。口コミ依頼のタイミングや文面をカスタマイズ可能。口コミ獲得率の向上をサポートします。',
    tags: ['口コミ依頼', '自動送信', '顧客管理', 'レビュー促進'],
    previewUrl: 'https://kutikomizidouka.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1uZ0NpxkU9G9GWWfhzSXnaWU5VZNxXX03-IyVxBSFgnY/edit?gid=1614302519#gid=1614302519',
    manualUrl: 'https://drive.google.com/file/d/1rOLvKTfTAPXB2cVIzDB36t8crALRQXpu/view?usp=drive_link',
  },
  {
    id: '06',
    name: '客単価分析＋アップセル提案',
    tagline: '購買データ分析・提案自動生成',
    description: '購買データから同時購入パターンを分析し、アップセル・クロスセル提案を自動生成。商品別・カテゴリ別の売上分析、提案の効果測定機能を搭載。',
    tags: ['客単価分析', 'アップセル', 'クロスセル', '購買分析'],
    previewUrl: 'https://upsell-teiann.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1B1FDsuPEM0-zZsO0K1HjpromAHMzW465b83z-AlW5p4/edit?gid=659006860#gid=659006860',
    manualUrl: 'https://drive.google.com/file/d/155J8_0QUBt2dAMWJN9eTEu8NtJdvOThF/view?usp=drive_link',
  },
  {
    id: '07',
    name: '納期アラートシステム',
    tagline: '案件の納期を一元管理・アラート通知',
    description: '案件の納期を一元管理し、超過・緊急案件を自動検出。ダッシュボードで進行中案件、超過案件、今週納期、今月完了を一目で確認。優先度別のリスト表示で見落としを防止します。',
    tags: ['納期管理', 'アラート通知', '案件管理', 'ダッシュボード'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbyxf1W8-DPh067BJos9Oyos-66p7elepz9q5BDfb2OnUgdzVtiajrkB8Dhk075iG9CecQ/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1CX7NlOY4jsZYu3Lgd0kPAGRmHTQee4hepLC4wWsVjjk/edit?gid=1958679551#gid=1958679551',
    manualUrl: '/manuals/nouki-alert.txt',
  },
  {
    id: '08',
    name: '必須タスクチェックリスト',
    tagline: 'テンプレートから漏れなくタスク管理',
    description: '業務テンプレートから自動でチェックリストを生成。タスクの進捗状況を可視化し、担当者別・期限別に管理。完了率や期限超過率を統計表示し、業務の抜け漏れを防止します。',
    tags: ['タスク管理', 'チェックリスト', 'テンプレート', '進捗管理'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbyXNVgbUztdyxHoMFbMhtinv3gEbHzJPK-1kD3eFNxMqy3-ozZRCLsn0hQ5u8M8htbLHA/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1hmOvlsFCuq0KbcqGRPUc8dC5NloMPxRzJ6fGGWqZUOs/edit?gid=1119511305#gid=1119511305',
    manualUrl: '/manuals/task-checklist.txt',
  },
  {
    id: '09',
    name: 'LTV（顧客生涯価値）計算',
    tagline: '顧客ランク別管理・特典自動設定',
    description: '顧客の累計購入額からLTVを自動計算し、S/A/B/Cランクに分類。ランク別の特典（毎回10%OFF、ポイント2倍など）を自動設定。上位顧客リスト、ランク分布をダッシュボードで確認できます。',
    tags: ['LTV計算', '顧客ランク', '特典管理', '売上分析'],
    previewUrl: 'https://ltv-kokyakukannri.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14J-OHb12HJf8MIHdQE2CeSlZaKt0oiinGTWYiG9Yzc8/edit?usp=sharing',
    manualUrl: 'https://drive.google.com/file/d/1HlfV2JYetYzV9oi7IYCBpfM6y85hdMnG/view?usp=drive_link',
  },
  {
    id: '10',
    name: '離脱顧客掘り起こし',
    tagline: '休眠顧客を自動抽出・復帰キャンペーン',
    description: '3ヶ月以上来店のない顧客を自動抽出し、セグメント別（3ヶ月/6ヶ月/1年）に分類。復帰キャンペーンメールをワンクリックで一括送信。クーポン発行・使用状況追跡機能も搭載。',
    tags: ['離脱顧客', 'メール配信', 'クーポン管理', '顧客復帰'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbx3XCd4NNbDwYE3hmqpDeny22WESwm5e0kp5QWs453er__BilO5jLHnFyNM6RP831yY/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1NTuhe-Z3924vQtY-FoGYZpUYeCRfm6FOtUzV9z9SxTg/edit?gid=222979078#gid=222979078',
    manualUrl: '/manuals/ridatsu-kokyaku-horiokoshi.txt',
  },
  {
    id: '11',
    name: '有効期限管理（資格・免許）',
    tagline: '資格・免許の期限を一元管理・自動通知',
    description: '従業員の資格・免許の有効期限を一元管理。期限切れリスクを自動検出し、Slack・メールで通知。ダッシュボードで要対応リスト、リスクレポート、アラート履歴を確認。CSVエクスポート・印刷機能も搭載。',
    tags: ['資格管理', '免許管理', '期限通知', 'リスク管理'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbyHOCjBB_x0XfO0x2vljC4jvEBhd4p2lcm4s9uIsEpaN6mgqXZbPgUSCAS2asK4e8zT/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/131aLO7LvIVqb4PDl0fpz_YChjLXFRUMzX36QGGQ1vFw/edit?gid=0#gid=0',
    manualUrl: '/manuals/yuukoukigen-kanri.txt',
  },
  {
    id: '12',
    name: '紹介プログラム完全管理',
    tagline: '紹介キャンペーンの一元管理・効果測定',
    description: '紹介プログラムを完全管理。紹介者・被紹介者の追跡、特典付与状況の管理、紹介効果の分析機能を搭載。紹介経由の売上貢献を可視化し、プログラムの最適化をサポートします。',
    tags: ['紹介管理', 'キャンペーン', '特典管理', '効果測定'],
    previewUrl: 'https://syoukaipuroguramu.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/17_SZw6VxNiMyvZlmCvOHdBPp-fY1CQb_19wfOSdJwJQ/edit?gid=1938890458#gid=1938890458',
    manualUrl: 'https://drive.google.com/file/d/1gFIv87jXMshPz4KKntapR_sSp5R-b38_/view?usp=drive_link',
  },
  {
    id: '13',
    name: '価格テストA/B管理',
    tagline: '価格A/Bテストの計画・実行・分析',
    description: 'EC・小売業向けの価格テスト管理ツール。商品マスタ、価格変更履歴、A/Bテスト計画・分析、価格弾力性分析、競合価格トラッキング機能を搭載。週次レポートをSlack・メールで自動送信。',
    tags: ['A/Bテスト', '価格最適化', '売上分析', '競合分析'],
    previewUrl: 'https://prise-a-b.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/14pec2Z0N6UGeseKrvIHGnEKiP4V_jT3oVjzncHsY_Hs/edit?gid=1443018878#gid=1443018878',
    manualUrl: 'https://drive.google.com/file/d/1yqCw10CkZTREx45SHs6Bt5WSQvZzLyzg/view?usp=drive_link',
  },
  {
    id: '14',
    name: 'キャンペーン効果測定',
    tagline: 'ROAS・ROI・CVを自動計算・可視化',
    description: 'マーケティングキャンペーンの効果を自動測定。コスト・流入データ・CVを登録し、ROAS・ROI・CPA・CVRを自動計算。チャネル別・月次・目的別の分析、施策比較マトリクスでPDCAを支援。',
    tags: ['効果測定', 'ROAS', 'ROI', 'マーケティング'],
    previewUrl: 'https://tubular-cucurucho-861ee7.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1LRLv1gslo1G34-DnnCGu4Q_ZFfyvz3Ly15Awl09xla0/edit?gid=1943435552#gid=1943435552',
    manualUrl: 'https://drive.google.com/file/d/1BfbmlJJMFXaftoHLTB-n_etsppINxeIH/view?usp=drive_link',
  },
  {
    id: '15',
    name: 'Casual Button',
    tagline: 'スカウトへの返答を1タップで完結',
    description: 'スカウトメッセージに1タップで返事できるURLを自動生成。候補者はリンクをタップするだけで回答でき、結果は管理画面とスプレッドシートに自動記録されます。スマホ・PC両対応。',
    tags: ['スカウト管理', 'URL生成', '候補者対応', '1タップ返信'],
    previewUrl: 'https://celadon-otter-c8de78.netlify.app/admin/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1UIo1RuvXOg8T425Jr_LiTBZHI0XI8k7q/edit?gid=1965445011#gid=1965445011',
    manualUrl: 'https://drive.google.com/file/d/1AriJmVBUthKeQOUCLTzCnkmO9K8UJp_KPCubCOVZCxc/view?usp=drive_link',
  },
  {
    id: '16',
    name: '経費精算ワークフロー',
    tagline: '経費申請・承認・精算の一元管理',
    description: '経費申請から承認、精算までのワークフローを一元管理。申請者・承認者別の画面、部署別・科目別の集計ダッシュボード、領収書画像のアップロード機能を搭載。未承認アラートで承認漏れを防止。',
    tags: ['経費精算', 'ワークフロー', '承認管理', '集計レポート'],
    previewUrl: '/demos/expense-workflow/index.html',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1IwI2JkYpO6K1ggAT_iG1UOkAkzjRiFb_xy8W0nJt5c0/edit?gid=0#gid=0',
    manualUrl: 'https://drive.google.com/file/d/1dyGqvWO0iD4ho9-WWLkK8gz9uL1mvqnI/view?usp=drive_link',
  },
  {
    id: '17',
    name: '請求書自動生成＋送付',
    tagline: 'BtoB向け請求書管理・自動送付',
    description: 'BtoB事業者向けの請求書管理システム。取引先・契約情報から請求書を自動生成、PDF化してメール送付。月額契約の自動請求、入金管理、督促送信機能を搭載。毎月1日に自動で請求書を生成します。',
    tags: ['請求書', '自動生成', 'PDF送付', '入金管理'],
    previewUrl: 'https://seikyusyokannri.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1TmZdGKNABVe3NPYrDXJ43XWgUUa8NPlbi5zC27w1XEo/edit?usp=sharing',
    manualUrl: 'https://drive.google.com/file/d/1qJkdrSY8YayfKLqXnbaEAfKsaerbPcPm/view?usp=drive_link',
  },
  {
    id: '18',
    name: '売上日報自動集計',
    tagline: '日次・週次・月次の売上レポート自動化',
    description: '日々の売上データをスプレッドシートに入力するだけで、週次・月次レポートを自動生成。客単価、曜日別分析、前年同月比較をダッシュボードで可視化。ニューモーフィズムデザインのモダンなUI。',
    tags: ['売上集計', '日報管理', 'レポート自動化', 'ダッシュボード'],
    previewUrl: 'https://nippoukannri.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '',
  },
  {
    id: '19',
    name: '契約更新リマインド',
    tagline: '契約期限の一元管理・更新通知',
    description: '契約の更新期限を一元管理。期限が近い契約をダッシュボードで一覧表示し、更新漏れを防止。契約登録、検索・フィルタ機能、期限別アラートを搭載。サブスク契約や保守契約の管理に最適。',
    tags: ['契約管理', '更新通知', 'リマインド', '期限管理'],
    previewUrl: 'https://keiyakukousin.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '',
  },
  {
    id: '20',
    name: '定例MTGアジェンダ自動収集',
    tagline: '議題収集・アジェンダ配信の自動化',
    description: '定例ミーティングの議題をWebフォームから収集し、アジェンダを自動生成・配信。議題種別（共有/相談/決定/ブレスト）、希望時間、優先度を設定可能。毎日自動で収集開始・リマインド送信。',
    tags: ['MTG管理', 'アジェンダ', '議題収集', '自動配信'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbykpzEy4wGv5BOA9MLYh3BX-duOfukK7u1KWCEs_WDVGdXm5Szq2Kd4egdSNh0Deqy0Dg/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1YAEtD3n0Dr0VjHu6nDwdj5GcLnJS1S7bgQUZuXLl7jI/edit?gid=530276671#gid=530276671',
    manualUrl: '/manuals/mtg-agenda-collector.txt',
  },
  {
    id: '21',
    name: 'ダブルブッキング防止（予約）',
    tagline: 'Web予約＋重複防止の自動チェック',
    description: 'Web予約システムにダブルブッキング防止機能を搭載。予約時にリアルタイムで空き状況を確認し、重複予約を自動でブロック。施設・人員・時間帯別の管理、キャンセル待ち機能も対応。',
    tags: ['予約管理', 'ダブルブッキング防止', '空き状況確認', 'キャンセル待ち'],
    previewUrl: 'https://doublebooking.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1jQJha2HUFYOugEVkOdmD_wi4-QwOm365xRC0F8vRrT0/edit',
    manualUrl: 'https://drive.google.com/file/d/1fMfbwa535SQul-fHaUeA85VzCz21yeX1/view?usp=drive_link',
  },
  {
    id: '22',
    name: '価格表・見積基準管理',
    tagline: '価格マスタ＋見積作成＋値引きルール',
    description: '価格マスタを一元管理し、見積書を自動生成。商品・サービス別の価格設定、数量・顧客ランク別の値引きルールを適用。見積履歴の管理、PDF出力、承認ワークフロー機能を搭載。',
    tags: ['価格管理', '見積作成', '値引きルール', 'PDF出力'],
    previewUrl: 'https://priselistandquotation.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '',
  },
  {
    id: '23',
    name: '議事録→タスク自動抽出',
    tagline: '議事録からTODOを自動抽出・リマインド',
    description: '議事録テキストからAIがタスクを自動抽出。担当者・期限を設定し、タスク一覧として管理。期限前リマインド、Slack・メール通知、進捗トラッキング機能で会議後のフォローを効率化。',
    tags: ['議事録管理', 'タスク抽出', 'リマインド', '進捗管理'],
    previewUrl: 'https://giziroku-taskauto.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1r3Y11a_vpj-LtEhGi6EBdVhTp3IyDxojB8rR4ENc7wA/edit?gid=102749190#gid=102749190',
    manualUrl: 'https://drive.google.com/file/d/12ZPq5ZpvExiILJf3Jk-blJM20oixdXTS/view?usp=drive_link',
  },
  {
    id: '24',
    name: '勤怠集計→給与計算連携',
    tagline: '勤怠打刻・残業管理・給与計算の自動化',
    description: '勤怠打刻から給与計算までを一気通貫で管理。出退勤記録、残業・深夜・休日勤務の自動集計、36協定チェック機能を搭載。給与計算システムへのCSV出力で連携。部署別・従業員別の勤務実績をダッシュボードで可視化。',
    tags: ['勤怠管理', '給与計算', '残業管理', '36協定'],
    previewUrl: 'https://kintgaisyuukei-kyuuyo.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1coC6dpyGBjvsOM3ZmAr1BbSnsYjmtm57YBbMhmK3J6Y/edit?gid=0#gid=0',
    manualUrl: 'https://drive.google.com/file/d/1OQHUz-58bqYj93zgZBDKNFOGrl6JmXqE/view?usp=drive_link',
  },
  {
    id: '25',
    name: '承認フロー強制',
    tagline: '申請→承認→実行の流れを可視化・強制',
    description: '「聞いてない」「誰が許可した？」を防ぐ承認フロー管理システム。申請→承認→実行の流れを強制し、承認履歴を完全記録。代理承認、一括承認、リマインド機能を搭載。監査ログでコンプライアンス対応も万全。',
    tags: ['承認フロー', 'ワークフロー', '監査ログ', 'コンプライアンス'],
    previewUrl: 'https://syouninn.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/10nlsRN8HWxrPlWiPK36y5R4O1v5-5-gbkobDq7SrcZ4/edit?gid=439925284#gid=439925284',
    manualUrl: 'https://drive.google.com/file/d/1VbErAJ_lHDUBdEtESkAuv-QESz2GQ3Gx/view?usp=drive_link',
  },
  {
    id: '26',
    name: '入金消込チェッカー',
    tagline: '請求と入金の自動マッチング・消込',
    description: '経理部門向けの入金消込管理ツール。請求データと入金データを自動突合し、振込名義からの取引先マッチング、振込手数料差額の自動処理を実行。督促前チェック、月次レポート、Slack・メール通知機能を搭載。',
    tags: ['入金消込', '請求管理', '自動マッチング', '督促管理'],
    previewUrl: 'https://nyukincheck.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1L4rqQYFdS94QTqxjIwcF9tG3MqwYsN2NJxLnUqu-S_g/edit?gid=1419751613#gid=1419751613',
    manualUrl: '/manuals/payment-reconciliation.txt',
  },
  {
    id: '27',
    name: '引継ぎチェックリスト',
    tagline: '引継ぎ項目の漏れ防止・進捗管理',
    description: '業務引継ぎ時のチェックリスト管理システム。引継ぎ項目をテンプレート化し、進捗をリアルタイムで可視化。担当者変更時のスムーズな業務移行を実現します。',
    tags: ['引継ぎ', 'チェックリスト', '進捗管理', '業務移行'],
    previewUrl: 'https://hikitugicheck.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1BNxcpNN32JtZaQAfA7iFrQX6T9GPe6h8AZH6yFisEaA/edit?gid=1828495788#gid=1828495788',
    manualUrl: 'https://drive.google.com/file/d/1gDj_qKlDb3HdUjed4g2RnRzKvIGDVONZ/view?usp=drive_link',
  },
  {
    id: '28',
    name: '定型連絡の自動送信',
    tagline: 'メール・LINE定型メッセージの自動配信',
    description: '定型メッセージのテンプレート管理・スケジュール配信システム。メール・LINE両対応で、月次レポート送付、メンテナンス案内、支払いリマインダーなどを自動送信。送信履歴・成功率の可視化機能付き。',
    tags: ['自動送信', 'テンプレート', 'メール', 'LINE', 'スケジュール'],
    previewUrl: 'https://teikei-renraku.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1lNXzMhf0rtvQ4bSJLCQ5RhYXlcgBW3-zjGZYog8z-Ac/edit?gid=823580013#gid=823580013',
    manualUrl: 'https://drive.google.com/file/d/13K-efYBgwjAK7VWfxnnL2sR3irO__8fy/view?usp=drive_link',
  },
  {
    id: '29',
    name: '解約理由分析',
    tagline: '解約理由の集計・トレンド分析ダッシュボード',
    description: '解約理由の集計・分析ダッシュボード。理由ランキング、トレンド推移、プラン別分析で改善施策を明確化。AIインサイト機能で対策提案も自動生成。解約率の改善に直結する分析ツール。',
    tags: ['解約分析', 'ダッシュボード', 'トレンド', '顧客管理'],
    previewUrl: 'https://kaiyaku-bunseki.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1YUWj5ORyHUuJdwu0EdcB5xYjTEOJuJ-YkPU3WeneKxM/edit?gid=0#gid=0',
    manualUrl: 'https://drive.google.com/file/d/1RifqVL4-WtDpLU-H4pnXY18ysi6Pwrnl/view?usp=drive_link',
  },
  {
    id: '30',
    name: 'シフト希望収集→自動調整',
    tagline: 'スタッフのシフト希望をWeb収集・自動調整',
    description: 'スタッフがWebからシフト希望を提出し、管理者が自動調整でシフトを作成。公平な配置を実現し、シフト作成の手間を大幅削減。カレンダー表示・PDF出力対応。',
    tags: ['シフト管理', '希望収集', '自動調整', 'スタッフ管理'],
    previewUrl: 'https://shift-kibou-shushu.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1WUGlDqDxiLktEfcP0KIjLXlqMOiTtDAWH3ZWhpZyeFw/edit?gid=499873547#gid=499873547',
    manualUrl: 'https://drive.google.com/file/d/1BfbmlJJMFXaftoHLTB-n_etsppINxeIH/view?usp=drive_link',
  },
  {
    id: '31',
    name: '在庫回転率管理',
    tagline: '商品別在庫回転率の自動計算・分析',
    description: '商品別の在庫回転率を自動計算し、滞留在庫を検出。発注点の最適化提案で在庫コストを削減。ABC分析、カテゴリ別分析、トレンドグラフで在庫状況を可視化。',
    tags: ['在庫管理', '回転率', 'ABC分析', 'コスト削減'],
    previewUrl: 'https://zaiko-kaitenritsu.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '',
  },
  {
    id: '32',
    name: '時間帯別売上分析',
    tagline: '時間帯・曜日別の売上データ自動集計',
    description: '時間帯・曜日別の売上データを自動集計・分析。ピーク時間の把握でシフト最適化や施策立案に活用。ヒートマップ・チャート表示で直感的に売上パターンを可視化。',
    tags: ['売上分析', '時間帯分析', 'ヒートマップ', 'シフト最適化'],
    previewUrl: 'https://jikantai-uriage.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '',
  },
  {
    id: '33',
    name: '業務マニュアル管理',
    tagline: '業務マニュアルの作成・管理・共有を一元化',
    description: '業務マニュアルの作成・バージョン管理・共有を一元化。カテゴリ別整理、全文検索、閲覧権限設定で最新情報を常に参照可能。新人教育・業務標準化に最適。',
    tags: ['マニュアル管理', 'ナレッジ共有', 'バージョン管理', '新人教育'],
    previewUrl: 'https://gyoumumanyuarukannri.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1qXL-Ap7MedpsJ4XlBmKupMdN-iqNMVWVlOk1C9nIZHc/edit?gid=85528303#gid=85528303',
    manualUrl: 'https://drive.google.com/file/d/1gbZ_828sKWEPeWZJt5BMJGZB9np3XjHh/view?usp=drive_link',
  },
  {
    id: '34',
    name: 'オンボーディング進捗管理',
    tagline: '新入社員の受入れ進捗を可視化・管理',
    description: '新入社員のオンボーディング進捗を可視化。タスク管理、メンター割当、評価レポート生成で受入れ体制を強化。部署別テンプレートで入社手続きを標準化。',
    tags: ['オンボーディング', '進捗管理', '新入社員', '人事管理'],
    previewUrl: 'https://onboarding-shintyoku.netlify.app/reports.html',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '',
  },
  {
    id: '35',
    name: '試用期間管理',
    tagline: '試用期間の評価・面談スケジュール管理',
    description: '試用期間の評価スケジュール・面談記録・判定を一元管理。期間満了アラートで手続き漏れを防止。評価シート・面談記録のテンプレート付き。',
    tags: ['試用期間', '評価管理', '面談管理', '人事管理'],
    previewUrl: 'https://shikenkikannkannri.netlify.app/evaluation',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1wHN13F6fhvFqKhSvz0M9qji7wuGZYzsrVM6G7KlJkZ4/edit?gid=1043137265#gid=1043137265',
    manualUrl: 'https://drive.google.com/file/d/1KlqPC3u29MvzvNfsL_GBMTxU25hVRG7-/view?usp=drive_link',
  },
  {
    id: '36',
    name: '季節変動予測',
    tagline: '過去データから季節トレンドを分析・予測',
    description: '過去の売上データから季節トレンドを分析し、需要予測を生成。仕入れ量・人員配置の最適化に活用。月別・四半期別のグラフ表示で直感的に把握。',
    tags: ['季節変動', '需要予測', 'トレンド分析', '仕入れ最適化'],
    previewUrl: 'https://kisetsuhendou.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1uLlnYIGg1-Y5MnVX-BiGf5r93nBgiRR_ZJNaEIqsMo4/edit?gid=0#gid=0',
    manualUrl: 'https://drive.google.com/file/d/1Oqm2F9dgUO-PlzGWmCoPq-u1SUOafRkM/view?usp=drive_linkk',
  },
  {
    id: '37',
    name: '顧問契約管理',
    tagline: '顧問契約の期間・報酬・更新を一元管理',
    description: '顧問契約の契約期間、報酬額、更新スケジュールを一元管理。更新リマインダー、契約書管理、報酬支払い履歴の可視化で契約管理業務を効率化。',
    tags: ['顧問契約', '契約管理', '更新リマインド', '報酬管理'],
    previewUrl: 'https://komonkannri.netlify.app/',
    iframeAllowed: false,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1ldLrsxvKCXkyqUSb1tK6mLYHBLdSabZwg-SUsACHudU/edit?gid=1182986624#gid=1182986624',
    manualUrl: 'https://drive.google.com/file/d/1ksA8vByglR2wLNpf1BJS3J_f1U4himEa/view?usp=drive_link',
  },
  {
    id: '38',
    name: '書類テンプレート管理',
    tagline: '業務書類テンプレートの一元管理・共有',
    description: '業務書類テンプレートの一元管理システム。カテゴリ別整理、バージョン管理、プレビュー機能で書類作成を効率化。社内共有・ダウンロード管理機能付き。',
    tags: ['テンプレート', '書類管理', 'バージョン管理', '社内共有'],
    previewUrl: 'https://syoruitemplate.netlify.app/',
    iframeAllowed: false,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1eLsvZMjukOMNnrfmlLSFf6zKOo-IB4oMRVH_gownRQk/edit?usp=sharing',
    manualUrl: 'https://drive.google.com/file/d/1Vb2OlIQyFcf8Sef4zrF7g6njD9HGmsk1/view?usp=drive_link',
  },
  {
    id: '39',
    name: '案件別工数管理',
    tagline: '案件ごとの工数記録・集計を自動化',
    description: '案件ごとの工数記録・集計を自動化。プロジェクト別のコスト管理、メンバー別の稼働状況、収益性分析で経営判断をサポート。タイムシート・レポート出力対応。',
    tags: ['工数管理', 'プロジェクト管理', 'コスト分析', '収益管理'],
    previewUrl: 'https://ankenbetu-kousu.netlify.app/#dashboard',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1fqzkWdTr_6iz--3zVB9IR1lAjDtirIYsEAXti0nucio/edit?gid=2063281868#gid=2063281868',
    manualUrl: 'https://drive.google.com/file/d/1gId2o2AasnbUEv4J5P57pPbXHX5lI96q/view?usp=drive_link',
  },
  {
    id: '40',
    name: '材料・消耗品管理',
    tagline: '材料・消耗品の在庫管理・発注管理を自動化',
    description: '材料・消耗品の在庫数量管理、使用量追跡、発注点管理を自動化。在庫切れアラート、発注書自動生成、コスト分析でムダを削減。カテゴリ別・拠点別管理対応。',
    tags: ['材料管理', '消耗品管理', '在庫管理', '発注管理'],
    previewUrl: 'https://zairyo-shoumouhin.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '',
  },
  {
    id: '41',
    name: 'Case Snapper',
    tagline: '事例の即検索・コピーで商談をスムーズに',
    description: '商談中やチャット対応中に、事例のURLやサマリをすばやく検索・コピーできるツール。業種・テーマ・キーワードで絞り込み、ワンクリックでURLやサマリをコピー。ブックマークレットでどのページからも呼び出し可能。',
    tags: ['事例検索', 'ワンクリックコピー', '商談支援', 'ブックマークレット'],
    previewUrl: 'https://tourmaline-rabanadas-36740a.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1XAjcUJKZ_JvaNnlx5G4Tz1QbgsEFJw0dqfK0gHjqbLI/edit?gid=152362143#gid=152362143',
    manualUrl: 'https://drive.google.com/file/d/1yl181PrmHnukZH3Kfmq6ZKftmY15ObwF/view?usp=drive_link',
  },
  {
    id: '42',
    name: 'スタッフ別生産性',
    tagline: 'スタッフごとの売上・生産性を可視化',
    description: 'スタッフごとの売上実績、勤怠データ、ランキングを自動集計・可視化するダッシュボード。店舗別アラート、生産性分析、サマリーレポートを搭載し、人材配置や評価の最適化を支援します。',
    tags: ['生産性分析', 'スタッフ管理', 'ランキング', 'ダッシュボード'],
    previewUrl: 'https://staff-productivity-sys.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1xy_ATLUxu7KK_6yEVQbdD2lgHIATHZL9VJy77kF-kQA/edit?gid=1944009414#gid=1944009414',
    manualUrl: '/manuals/staff-productivity.txt',
  },
  {
    id: '43',
    name: '顧客対応履歴一元化',
    tagline: '全チャネルの顧客対応を一元管理',
    description: '電話・メール・チャット・対面など全チャネルの顧客対応履歴を一元管理。顧客別の対応タイムライン、検索・フィルタ機能、対応品質の分析レポートを提供し、チーム全体の対応品質を向上させます。',
    tags: ['顧客対応', '履歴管理', '一元化', '対応品質'],
    previewUrl: 'https://customer-history-sys.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1L02pSX9xzenH-w16-ef4hpe98t8KPuociQxA7vXb4oc/edit?gid=653270564#gid=653270564',
    manualUrl: '/manuals/customer-history.txt',
  },
  {
    id: '44',
    name: '売上ダッシュボード',
    tagline: '売上データをリアルタイムに可視化',
    description: '日次・週次・月次の売上データをリアルタイムに集計・可視化するダッシュボード。商品別・カテゴリ別の売上分析、予測機能、トリガー通知を搭載し、経営判断をデータで支援します。',
    tags: ['売上分析', 'ダッシュボード', '予測', 'リアルタイム'],
    previewUrl: 'https://sales-dashboard-sys.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1goK0-8waNVHJr5uCQd2mupewepRBAW-eqigWGJyd9bU/edit?gid=959219761#gid=959219761',
    manualUrl: '/manuals/sales-dashboard.txt',
  },
  {
    id: '45',
    name: 'FAQ管理＋検索',
    tagline: 'FAQの作成・検索・分析を一元化',
    description: 'FAQの作成・カテゴリ管理・タグ管理・全文検索を一元化。キーワード分析、未解決質問の追跡、改善提案機能を搭載し、ナレッジベースの継続的な改善を支援します。',
    tags: ['FAQ管理', '全文検索', 'ナレッジ管理', '分析'],
    previewUrl: 'https://sunny-platypus-855e15.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1l7oJ7dTzfucMKhfIpvhXaF3CXeZnMR4lUNPG7mLoBkM/edit?gid=587343578#gid=587343578',
    manualUrl: '/manuals/faq-management.txt',
  },
  {
    id: '46',
    name: 'トラブル対応履歴',
    tagline: 'トラブル対応の記録・検索・分析',
    description: 'トラブル・インシデントの発生から解決までを一元管理。対応履歴の検索、原因分析、再発防止策の管理機能を搭載。過去の対応ノウハウを蓄積し、チームの問題解決力を向上させます。',
    tags: ['トラブル管理', '対応履歴', '原因分析', '再発防止'],
    previewUrl: 'https://trouble-history-sys.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1eSmoYQnACSBhbGxr3qi8S-KdASKJDb9hpst9zkVndfU/edit?gid=1755918717#gid=1755918717',
    manualUrl: '/manuals/trouble-history.txt',
  },
  {
    id: '47',
    name: '判断基準の明文化',
    tagline: '社内の判断基準を見える化して管理',
    description: '社内の判断基準を「見える化」して記録・共有するシステム。誰がどんな基準でどう判断したかを一元管理し、判断のブレを防止。領域別の基準管理、判断事例の蓄積、適用率分析、例外判断アラート機能を搭載します。',
    tags: ['判断基準', 'ナレッジ管理', '標準化', '品質管理'],
    previewUrl: 'https://delightful-daffodil-98a013.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1zdi1h2d1YRyRCjmkXMRL8cw-om5k7-SCN-eHYck9GL4/edit?gid=1582525583#gid=1582525583',
    manualUrl: '/manuals/decision-criteria.txt',
  },
  {
    id: '48',
    name: '顧客情報重複チェック',
    tagline: '顧客データの重複を自動検出・名寄せ',
    description: '顧客情報の重複を自動検出し、名寄せ（統合）を支援するシステム。氏名・電話番号・メールアドレスの類似度スコアで重複候補を検出。統合・非重複の判定、名寄せ履歴の管理機能を搭載します。',
    tags: ['顧客管理', '重複チェック', '名寄せ', 'データクレンジング'],
    previewUrl: 'https://kokyakutyouhuku.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '/manuals/customer-dedup.txt',
  },
  {
    id: '49',
    name: '契約書バージョン管理',
    tagline: '契約書テンプレートの版数を一元管理',
    description: '契約書テンプレートのバージョン管理を行い、古いテンプレートでの契約締結を防止。テンプレート版数管理、旧版使用アラート、見直し期限管理、法改正対応状況の追跡機能を搭載します。',
    tags: ['契約管理', 'バージョン管理', 'コンプライアンス', 'アラート'],
    previewUrl: 'https://joyful-figolla-c45acc.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1MJNbjbEg0hpEQ1vErhbhUxbG__y-5a2UwmVdZtwjc6Y/edit?gid=1899245658#gid=1899245658',
    manualUrl: '/manuals/contract-version.txt',
  },
  {
    id: '50',
    name: '備品在庫アラート',
    tagline: '備品の在庫管理と自動発注アラート',
    description: '備品の在庫数をリアルタイムに管理し、発注点を下回ったらアラートを表示するシステム。在庫操作記録、発注管理、納品処理、在庫履歴の追跡機能を搭載。消耗品の欠品を防ぎます。',
    tags: ['在庫管理', 'アラート', '備品管理', '発注管理'],
    previewUrl: 'https://bihinnzaiko.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: '',
    manualUrl: '/manuals/supply-alert.txt',
  },
  {
    id: '51',
    name: '施術メニュー別売上分析',
    tagline: '施術メニューごとの売上・収益性を分析',
    description: '施術メニューごとの売上・利益・原価を詳細に分析するダッシュボード。日次・週次・月次集計、カテゴリ別比較、収益性分析、セットメニュー管理、スタッフ別実績の追跡機能を搭載します。',
    tags: ['売上分析', '施術管理', '収益性', 'サロン'],
    previewUrl: 'https://zesty-genie-abd0ce.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1D7ff9TQTWqn2DLuXMGcI9uQLNwtAQO_AzpEyNpPA9Wk/edit?gid=187506647#gid=187506647',
    manualUrl: '/manuals/treatment-sales.txt',
  },
  {
    id: '52',
    name: 'Lobby LP',
    tagline: '面接候補者向け案内ページを簡単発行',
    description: '面接に来る候補者向けに「おすすめ記事」と「当日の案内情報」をまとめたWebページを簡単に発行できるツール。コンテンツ管理、記事セットテンプレート、会場情報管理、候補者別ページ発行機能を搭載します。',
    tags: ['採用', '候補者管理', 'LP作成', '面接案内'],
    previewUrl: 'https://lighthearted-empanada-a33b97.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1yRD4bbA_7ccQnoWmIgpEh_M1PvJc0ppLlH_WhWBjShM/edit?gid=1732536644#gid=1732536644',
    manualUrl: '/manuals/lobby-lp.txt',
  },
  {
    id: '53',
    name: 'Pizza Tracker',
    tagline: '採用選考の進捗をピザ形式で可視化',
    description: '採用選考プロセスをピザトラッカー風に可視化する候補者管理システム。候補者登録、選考ステップ管理、ステータス更新通知、パイプライン管理機能を搭載。候補者体験を向上させます。',
    tags: ['採用管理', '進捗管理', '候補者体験', '選考プロセス'],
    previewUrl: 'https://genuine-cat-33e783.netlify.app/',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1zkZe1ta-b1Aah77J8miDTPznLP_cvHEpSRSPCzvCPS4/edit?gid=1580414687#gid=1580414687',
    manualUrl: '/manuals/pizza-tracker.txt',
  },
  {
    id: '54',
    name: 'Welcome Snap',
    tagline: '面接官の挨拶動画を録画・共有',
    description: '面接官が候補者に送る15秒の挨拶動画を録画・共有するツール。GAS HtmlService版でカメラ録画、Google Drive保存、共有URL発行、期限切れ自動処理を搭載。候補者体験を向上させます。',
    tags: ['採用支援', '動画録画', '候補者体験', 'Google Drive'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbxj4-HiWY_0QwjgjiRlmlU1x-ZQ6Plp6un6MP0zzrvAgZZXQUSJwVIjl5zSvj8bl1vO/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1sB4we97k8wJ0OPPKH__yGYG263t0bwb1UamIEdJCRj0/edit?gid=1055425724#gid=1055425724',
    manualUrl: '/manuals/welcome-snap.txt',
  },
  {
    id: '55',
    name: '粗利管理',
    tagline: '売上・原価データから粗利を分析・管理',
    description: '売上・原価データの登録から粗利分析、アラート通知、シミュレーションまでを一元管理。商品別・顧客別・担当者別の粗利分析、月次サマリー、粗利目標管理、原価変動追跡機能を搭載。Chart.jsによるグラフ表示でデータを可視化します。',
    tags: ['粗利管理', '売上分析', 'アラート通知', 'シミュレーション'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbzmD9RMr-xOQzI0fjGWJJ1iiMbB1Hswv67qTZtIbfh_cf1ck8dgIgID3QnN6KPPIfW-2A/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1s5e8Kv8fxBWWQIHfLnh6XL-BTvnsbIZlAba8bEixyc8/edit',
    manualUrl: '/manuals/arari-kanri.txt',
  },
  {
    id: '56',
    name: '顧客別収益性分析',
    tagline: '顧客ごとの収益性をABC・LTV・セグメントで多角分析',
    description: '顧客マスタ・売上・コスト工数を登録し、月次/年次の収益サマリー、ABC分析、デシル分析、LTV分析、セグメント分類、戦略マトリクス、担当者ポートフォリオを自動算出。ダッシュボードでKPIとChart.jsグラフを一覧表示し、売上減少・休眠・粗利率低下をメールアラートで通知します。',
    tags: ['収益性分析', '顧客管理', 'ABC分析', 'LTV', 'セグメント'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbxqVf5Ozhjv8bbmupeBwJYrwclON2ttQbD4d0xkoRdc5TSBoc7pIOpb1dqYFPD_JcBKag/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1LPH_WQiKLcEgIkMnpIBd1M20SHEqpnD9I4bgtG5mqeQ/edit',
    manualUrl: '/manuals/kokyaku-shuekisei-bunseki.txt',
  },
  {
    id: '57',
    name: 'カルテ管理（美容・整体）',
    tagline: '美容室・整体院の顧客カルテを一元管理',
    description: '美容室・整体院向けの顧客カルテ管理システム。顧客情報、施術記録（美容/整体対応）、アレルギー・禁忌管理、ビフォーアフター写真、予約管理、施術傾向分析、整体効果追跡を搭載。SVG身体図での痛み部位選択やクイック確認機能で施術前の情報把握を支援します。',
    tags: ['カルテ管理', '美容・整体', '顧客管理', '予約管理'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbw1m4LMukiEJMRzePAuJUDqJcBoAf1qrkQp6K-E-afwC9LPGnLTi2yJqLLEjkgBWRKr/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1tQoepHXzT7UAWItzG-u3LzEliPUKV2WU08ZVv2ypT2Y/edit',
    manualUrl: '/manuals/karte-kanri.txt',
  },
  {
    id: '58',
    name: 'ナレッジベース',
    tagline: '組織の知識・ノウハウを一元管理・検索・活用',
    description: '業務ノウハウ・知識を登録・分類・全文検索できるナレッジ管理システム。タグ・同義語による高精度検索、5段階評価・フィードバック、エキスパートマッピング、質問・相談機能、月次分析・要更新自動検出を搭載。退職・異動による知識喪失を防ぎ、組織全体のナレッジ活用を促進します。',
    tags: ['ナレッジ管理', '全文検索', 'エキスパート', '分析・レポート'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbymFk0zLHo65iRBLUvrNwBpEysfO_gACPmcXl0Ry8reZLXbfoKuWfiUWf--C1TbOwLj/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1aYfNTco9ci65-bH7ldFMys7YjF7GSCdF9I2ZGGqAfB0/edit?usp=sharing',
    manualUrl: '/manuals/knowledge-base.txt',
  },
  {
    id: '59',
    name: 'Dynamic OGP',
    tagline: '候補者名入りOGP画像でスカウトのクリック率UP',
    description: 'スカウトメッセージに貼るURLのOGP画像を候補者名入りにパーソナライズするツール。Google SlidesテンプレートからPNG画像を自動生成し、LINE/Slack等でOGPプレビュー表示。クリック計測・ダッシュボード管理機能付き。',
    tags: ['採用支援', 'OGP画像', 'スカウト', 'LINE対応'],
    previewUrl: 'https://script.google.com/macros/s/AKfycbwLpHTEHO11IKgYUOev9aICG4ogSPQMb3kyWWGBhQ8eQ1OgL7b3TT7U2MuUTyKzU4hM/exec',
    iframeAllowed: true,
    spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1kxBEi3fsllCl8Bzc3YVdyLtp2akf7GjIMX_U4d80lyY/edit?gid=999112693#gid=999112693',
    manualUrl: '/manuals/dynamic-ogp.txt',
  },
]

export default function SystemCatalogPage() {
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>('01')
  const [searchQuery, setSearchQuery] = useState('')
  // モバイルでは最初からサイドバー（システム一覧）を開いた状態にする
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // 認証状態（LINE Bot経由の署名付きURLで有料/無料を判定）
  const [auth, setAuth] = useState<AuthState>({
    loading: true,
    authenticated: false,
    isPaid: false,
    planName: '',
    authParams: '',
    downloadsRemaining: 0,
    downloadsLimit: 0,
    freeDownloadAvailable: false,
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)

    // URLの id パラメータでシステム初期選択
    const idParam = params.get('id')
    if (idParam) {
      const padded = idParam.padStart(2, '0')
      if (systems.find(s => s.id === padded)) {
        setSelectedSystemId(padded)
        setIsSidebarOpen(false)
      }
    }

    // 署名付きURL認証
    const u = params.get('u')
    const t = params.get('t')
    const s = params.get('s')

    if (!u || !t || !s) {
      // 署名パラメータなし → 未認証（直接アクセス）
      setAuth({ loading: false, authenticated: false, isPaid: false, planName: '', authParams: '', downloadsRemaining: 0, downloadsLimit: 0, freeDownloadAvailable: false })
      return
    }

    const authParams = `u=${encodeURIComponent(u)}&t=${t}&s=${s}`

    fetch(`/api/systems/catalog-auth?${authParams}`)
      .then(res => res.json())
      .then(data => {
        setAuth({
          loading: false,
          authenticated: data.authenticated || false,
          isPaid: data.isPaid || false,
          planName: data.planName || '',
          authParams,
          downloadsRemaining: data.downloadsRemaining || 0,
          downloadsLimit: data.downloadsLimit || 0,
          freeDownloadAvailable: data.freeDownloadAvailable || false,
        })
      })
      .catch(() => {
        setAuth({ loading: false, authenticated: false, isPaid: false, planName: '', authParams: '', downloadsRemaining: 0, downloadsLimit: 0, freeDownloadAvailable: false })
      })
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
                      ${selectedSystemId === system.id
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
                    {/* ダウンロードボタンエリア */}
                    <div className="flex flex-col gap-2 w-full sm:w-auto">
                      {auth.loading ? (
                        /* ローディング中 */
                        <div className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gray-400 cursor-default">
                          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          読み込み中...
                        </div>
                      ) : auth.isPaid && selectedSystem.spreadsheetUrl && auth.downloadsRemaining > 0 ? (
                        /* 有料ユーザー + スプレッドシートあり + 残回数あり → ダウンロード可能 */
                        <>
                          <a
                            href={`/api/systems/download?id=${selectedSystem.id}&${auth.authParams}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transition-all shadow-lg shadow-green-500/30"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                              <path d="M7 12h2v5H7zm4-7h2v12h-2zm4 4h2v8h-2z" />
                            </svg>
                            システムをダウンロード
                          </a>
                          <p className="text-xs text-center text-emerald-600">
                            今月の残り: {auth.downloadsRemaining}/{auth.downloadsLimit}回
                          </p>
                        </>
                      ) : auth.isPaid && selectedSystem.spreadsheetUrl && auth.downloadsRemaining <= 0 ? (
                        /* 有料ユーザー + スプレッドシートあり + 上限到達 → ダウンロード不可 */
                        <>
                          <div className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gray-400 cursor-default">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                              <path d="M7 12h2v5H7zm4-7h2v12h-2zm4 4h2v8h-2z" />
                            </svg>
                            今月の上限に達しました
                          </div>
                          <p className="text-xs text-center text-orange-600 font-medium">
                            月{auth.downloadsLimit}回まで（来月リセットされます）
                          </p>
                        </>
                      ) : auth.isPaid && !selectedSystem.spreadsheetUrl ? (
                        /* 有料ユーザー + スプレッドシートなし → 準備中 + 面談誘導 */
                        <>
                          <div className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gray-400 cursor-default">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                              <path d="M7 12h2v5H7zm4-7h2v12h-2zm4 4h2v8h-2z" />
                            </svg>
                            準備中
                          </div>
                          <a
                            href="https://timerex.net/s/cz1917903_47c5/7caf7949"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/30"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            このシステムについて無料相談
                          </a>
                          <p className="text-xs text-center text-gray-500">
                            導入・カスタマイズのご相談を承ります
                          </p>
                        </>
                      ) : auth.freeDownloadAvailable && selectedSystem.spreadsheetUrl ? (
                        /* 無料ユーザー + 初回DL未使用 + スプレッドシートあり → 初回無料DL可能 */
                        <>
                          <a
                            href={`/api/systems/download?id=${selectedSystem.id}&${auth.authParams}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 transition-all shadow-lg shadow-amber-500/30"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                              <path d="M7 12h2v5H7zm4-7h2v12h-2zm4 4h2v8h-2z" />
                            </svg>
                            初回無料DL
                          </a>
                          <p className="text-xs text-center text-amber-600 font-medium">
                            初回限定 1回無料でダウンロードできます
                          </p>
                        </>
                      ) : (
                        /* 無料ユーザー（使用済み） or 未認証 → 面談誘導 */
                        <>
                          <div className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg shadow-green-500/30 cursor-default opacity-60">
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14z" />
                              <path d="M7 12h2v5H7zm4-7h2v12h-2zm4 4h2v8h-2z" />
                            </svg>
                            システムをダウンロード
                          </div>
                          <p className="text-xs text-center text-gray-500">
                            有料プラン限定
                          </p>
                          <a
                            href="https://timerex.net/s/cz1917903_47c5/7caf7949"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 transition-all shadow-lg shadow-orange-500/30"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            無料相談を予約する
                          </a>
                          <p className="text-xs text-center text-orange-600 font-medium">
                            導入のご質問・お見積り・カスタマイズ相談
                          </p>
                        </>
                      )}
                      {auth.isPaid && (
                        <p className="text-xs text-center text-emerald-600 font-medium">
                          {auth.planName}
                        </p>
                      )}
                    </div>

                    {/* 使い方説明書ボタン */}
                    {selectedSystem.manualUrl && (
                      <div className="flex flex-col gap-2 w-full sm:w-auto">
                        <a
                          href={selectedSystem.manualUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-2 px-6 py-3 font-bold text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-xl transition-all shadow-lg shadow-blue-500/30"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          使い方説明書を見る
                        </a>
                        <p className="text-xs text-center text-gray-500">
                          セットアップ手順を確認できます
                        </p>
                      </div>
                    )}

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
