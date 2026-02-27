/**
 * システムデータ共有モジュール
 * app/api/system-recommendation/route.ts と lib/line/diagnosis-handler.ts で共有
 */

export interface SystemData {
  id: string
  name: string
  tagline: string
  tags: string[]
}

/** システムID → スプレッドシートURL対応表（カタログと同一データ） */
const SPREADSHEET_URLS: Record<string, string> = {
  '01': 'https://docs.google.com/spreadsheets/d/1yeys-GTCkYXvpWHSaBSvCjknsFcY5TmSx6-r-q_Aaxw/edit?gid=616392511#gid=616392511',
  '02': 'https://docs.google.com/spreadsheets/d/1AEcS-LktDotRlM4uDflSfHatPn_jqJHBB7blSq5tKYk/edit?gid=584518683#gid=584518683',
  '03': 'https://docs.google.com/spreadsheets/d/1ZhTAYfu1jdceDk4Qozvxbff4XRS0EbkQ53276SSaexw/edit?gid=1843148959#gid=1843148959',
  '04': 'https://docs.google.com/spreadsheets/d/1RZCDCFeXin0AXievOao8DBbO9xNaezFNIJJdtEKB13c/edit?gid=0#gid=0',
  '05': 'https://docs.google.com/spreadsheets/d/1uZ0NpxkU9G9GWWfhzSXnaWU5VZNxXX03-IyVxBSFgnY/edit?gid=1614302519#gid=1614302519',
  '06': 'https://docs.google.com/spreadsheets/d/1B1FDsuPEM0-zZsO0K1HjpromAHMzW465b83z-AlW5p4/edit?gid=659006860#gid=659006860',
  '09': 'https://docs.google.com/spreadsheets/d/14J-OHb12HJf8MIHdQE2CeSlZaKt0oiinGTWYiG9Yzc8/edit?usp=sharing',
  '10': 'https://docs.google.com/spreadsheets/d/1_a3-zSwU2FK_fWysFQMd_edDQeLYeFgAD4WogOx0jo4/edit?usp=sharing',
  '13': 'https://docs.google.com/spreadsheets/d/14pec2Z0N6UGeseKrvIHGnEKiP4V_jT3oVjzncHsY_Hs/edit?gid=1443018878#gid=1443018878',
  '14': 'https://docs.google.com/spreadsheets/d/1LRLv1gslo1G34-DnnCGu4Q_ZFfyvz3Ly15Awl09xla0/edit?gid=1943435552#gid=1943435552',
  '16': 'https://docs.google.com/spreadsheets/d/1IwI2JkYpO6K1ggAT_iG1UOkAkzjRiFb_xy8W0nJt5c0/edit?gid=0#gid=0',
  '21': 'https://docs.google.com/spreadsheets/d/1jQJha2HUFYOugEVkOdmD_wi4-QwOm365xRC0F8vRrT0/edit',
  '23': 'https://docs.google.com/spreadsheets/d/1r3Y11a_vpj-LtEhGi6EBdVhTp3IyDxojB8rR4ENc7wA/edit?gid=102749190#gid=102749190',
  '24': 'https://docs.google.com/spreadsheets/d/1coC6dpyGBjvsOM3ZmAr1BbSnsYjmtm57YBbMhmK3J6Y/edit?gid=0#gid=0',
  '27': 'https://docs.google.com/spreadsheets/d/1BNxcpNN32JtZaQAfA7iFrQX6T9GPe6h8AZH6yFisEaA/edit?gid=1828495788#gid=1828495788',
  '29': 'https://docs.google.com/spreadsheets/d/1YUWj5ORyHUuJdwu0EdcB5xYjTEOJuJ-YkPU3WeneKxM/edit?gid=0#gid=0',
  '30': 'https://docs.google.com/spreadsheets/d/1WUGlDqDxiLktEfcP0KIjLXlqMOiTtDAWH3ZWhpZyeFw/edit?gid=499873547#gid=499873547',
  '33': 'https://docs.google.com/spreadsheets/d/1qXL-Ap7MedpsJ4XlBmKupMdN-iqNMVWVlOk1C9nIZHc/edit?gid=85528303#gid=85528303',
  '36': 'https://docs.google.com/spreadsheets/d/1uLlnYIGg1-Y5MnVX-BiGf5r93nBgiRR_ZJNaEIqsMo4/edit?gid=0#gid=0',
  '37': 'https://docs.google.com/spreadsheets/d/1ldLrsxvKCXkyqUSb1tK6mLYHBLdSabZwg-SUsACHudU/edit?gid=1182986624#gid=1182986624',
  '39': 'https://docs.google.com/spreadsheets/d/1fqzkWdTr_6iz--3zVB9IR1lAjDtirIYsEAXti0nucio/edit?gid=2063281868#gid=2063281868',
  '41': 'https://docs.google.com/spreadsheets/d/1XAjcUJKZ_JvaNnlx5G4Tz1QbgsEFJw0dqfK0gHjqbLI/edit?gid=152362143#gid=152362143',
  '42': 'https://docs.google.com/spreadsheets/d/1g3NoofvrzMaCOrKSoaKOAokQs0AxNYPpcDCF2i-fof0/edit',
}

/** システムIDからスプレッドシートURLを取得 */
export function getSpreadsheetUrl(systemId: string): string {
  const padded = systemId.padStart(2, '0')
  return SPREADSHEET_URLS[padded] || ''
}

export function getSystemsData(): SystemData[] {
  return [
    { id: '01', name: '営業日報システム', tagline: '日報入力・週報月報自動生成', tags: ['日報管理', '自動集計', 'GAS連携', 'Soft UI'] },
    { id: '02', name: '失客アラートシステム', tagline: '顧客の失客リスクを自動検知・通知', tags: ['失客検知', '自動通知', '顧客管理', 'リスク分析'] },
    { id: '03', name: '期限管理システム', tagline: '届出期限の一元管理・アラート通知', tags: ['期限管理', 'アラート通知', '顧客管理', 'ダッシュボード'] },
    { id: '04', name: 'リピート促進メールシステム', tagline: '来店後フォローアップの自動化', tags: ['リピート促進', '自動メール', '顧客フォロー', 'テンプレート管理'] },
    { id: '05', name: '口コミ依頼自動化システム', tagline: '口コミ依頼の自動送信・管理', tags: ['口コミ依頼', '自動送信', '顧客管理', 'レビュー促進'] },
    { id: '06', name: '客単価分析＋アップセル提案', tagline: '購買データ分析・提案自動生成', tags: ['客単価分析', 'アップセル', 'クロスセル', '購買分析'] },
    { id: '07', name: '納期アラートシステム', tagline: '案件の納期を一元管理・アラート通知', tags: ['納期管理', 'アラート通知', '案件管理', 'ダッシュボード'] },
    { id: '08', name: '必須タスクチェックリスト', tagline: 'テンプレートから漏れなくタスク管理', tags: ['タスク管理', 'チェックリスト', 'テンプレート', '進捗管理'] },
    { id: '09', name: 'LTV（顧客生涯価値）計算', tagline: '顧客ランク別管理・特典自動設定', tags: ['LTV計算', '顧客ランク', '特典管理', '売上分析'] },
    { id: '10', name: '離脱顧客掘り起こし', tagline: '休眠顧客を自動抽出・復帰キャンペーン', tags: ['離脱顧客', 'メール配信', 'クーポン管理', '顧客復帰'] },
    { id: '11', name: '有効期限管理（資格・免許）', tagline: '資格・免許の期限を一元管理・自動通知', tags: ['資格管理', '免許管理', '期限通知', 'リスク管理'] },
    { id: '12', name: '紹介プログラム完全管理', tagline: '紹介キャンペーンの一元管理・効果測定', tags: ['紹介管理', 'キャンペーン', '特典管理', '効果測定'] },
    { id: '13', name: '価格テストA/B管理', tagline: '価格A/Bテストの計画・実行・分析', tags: ['A/Bテスト', '価格最適化', '売上分析', '競合分析'] },
    { id: '14', name: 'キャンペーン効果測定', tagline: 'ROAS・ROI・CVを自動計算・可視化', tags: ['効果測定', 'ROAS', 'ROI', 'マーケティング'] },
    { id: '16', name: '経費精算ワークフロー', tagline: '経費申請・承認・精算の一元管理', tags: ['経費精算', 'ワークフロー', '承認管理', '集計レポート'] },
    { id: '17', name: '請求書自動生成＋送付', tagline: 'BtoB向け請求書管理・自動送付', tags: ['請求書', '自動生成', 'PDF送付', '入金管理'] },
    { id: '18', name: '売上日報自動集計', tagline: '日次・週次・月次の売上レポート自動化', tags: ['売上集計', '日報管理', 'レポート自動化', 'ダッシュボード'] },
    { id: '19', name: '契約更新リマインド', tagline: '契約期限の一元管理・更新通知', tags: ['契約管理', '更新通知', 'リマインド', '期限管理'] },
    { id: '20', name: '定例MTGアジェンダ自動収集', tagline: '議題収集・アジェンダ配信の自動化', tags: ['MTG管理', 'アジェンダ', '議題収集', '自動配信'] },
    { id: '21', name: 'ダブルブッキング防止（予約）', tagline: 'Web予約＋重複防止の自動チェック', tags: ['予約管理', 'ダブルブッキング防止', '空き状況確認', 'キャンセル待ち'] },
    { id: '22', name: '価格表・見積基準管理', tagline: '価格マスタ＋見積作成＋値引きルール', tags: ['価格管理', '見積作成', '値引きルール', 'PDF出力'] },
    { id: '23', name: '議事録→タスク自動抽出', tagline: '議事録からTODOを自動抽出・リマインド', tags: ['議事録管理', 'タスク抽出', 'リマインド', '進捗管理'] },
    { id: '24', name: '勤怠集計→給与計算連携', tagline: '勤怠打刻・残業管理・給与計算の自動化', tags: ['勤怠管理', '給与計算', '残業管理', '36協定'] },
    { id: '25', name: '承認フロー強制', tagline: '申請→承認→実行の流れを可視化・強制', tags: ['承認フロー', 'ワークフロー', '監査ログ', 'コンプライアンス'] },
    { id: '26', name: '入金消込チェッカー', tagline: '請求と入金の自動マッチング・消込', tags: ['入金消込', '請求管理', '自動マッチング', '督促管理'] },
    { id: '27', name: '引継ぎチェックリスト', tagline: '引継ぎ項目の漏れ防止・進捗管理', tags: ['引継ぎ', 'チェックリスト', '進捗管理', '業務移行'] },
    { id: '28', name: '定型連絡の自動送信', tagline: 'メール・LINE定型メッセージの自動配信', tags: ['自動送信', 'テンプレート', 'メール', 'LINE'] },
    { id: '29', name: '解約理由分析', tagline: '解約理由の集計・トレンド分析ダッシュボード', tags: ['解約分析', 'ダッシュボード', 'トレンド', '顧客管理'] },
    { id: '30', name: 'シフト希望収集→自動調整', tagline: 'スタッフのシフト希望をWeb収集・自動調整', tags: ['シフト管理', '希望収集', '自動調整', 'スタッフ管理'] },
    { id: '31', name: '在庫回転率管理', tagline: '商品別在庫回転率の自動計算・分析', tags: ['在庫管理', '回転率', 'ABC分析', 'コスト削減'] },
    { id: '32', name: '時間帯別売上分析', tagline: '時間帯・曜日別の売上データ自動集計', tags: ['売上分析', '時間帯分析', 'ヒートマップ', 'シフト最適化'] },
    { id: '33', name: '業務マニュアル管理', tagline: '業務マニュアルの作成・管理・共有を一元化', tags: ['マニュアル管理', 'ナレッジ共有', 'バージョン管理', '新人教育'] },
    { id: '34', name: 'オンボーディング進捗管理', tagline: '新入社員の受入れ進捗を可視化・管理', tags: ['オンボーディング', '進捗管理', '新入社員', '人事管理'] },
    { id: '35', name: '試用期間管理', tagline: '試用期間の評価・面談スケジュール管理', tags: ['試用期間', '評価管理', '面談管理', '人事管理'] },
    { id: '36', name: '季節変動予測', tagline: '過去データから季節トレンドを分析・予測', tags: ['季節変動', '需要予測', 'トレンド分析', '仕入れ最適化'] },
    { id: '37', name: '顧問契約管理', tagline: '顧問契約の期間・報酬・更新を一元管理', tags: ['顧問契約', '契約管理', '更新リマインド', '報酬管理'] },
    { id: '38', name: '書類テンプレート管理', tagline: '業務書類テンプレートの一元管理・共有', tags: ['テンプレート', '書類管理', 'バージョン管理', '社内共有'] },
    { id: '39', name: '案件別工数管理', tagline: '案件ごとの工数記録・集計を自動化', tags: ['工数管理', 'プロジェクト管理', 'コスト分析', '収益管理'] },
    { id: '40', name: '材料・消耗品管理', tagline: '材料・消耗品の在庫管理・発注管理を自動化', tags: ['材料管理', '消耗品管理', '在庫管理', '発注管理'] },
    { id: '41', name: 'Case Snapper', tagline: '事例の即検索・コピーで商談をスムーズに', tags: ['事例検索', 'ワンクリックコピー', '商談支援', 'ブックマークレット'] },
    { id: '42', name: 'FirstLine AI', tagline: 'コールドメールの冒頭フックをAIで自動生成', tags: ['AI生成', 'コールドメール', 'フック生成', '営業支援'] },
  ]
}
