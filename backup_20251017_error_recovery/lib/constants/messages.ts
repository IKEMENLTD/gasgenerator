// 定型メッセージ定数

export const SYSTEM_MESSAGES = {
  WELCOME: '🤖 GAS自動生成システムへようこそ！\n\nどんなGoogle Apps Scriptのコードを作りたいですか？\n下のボタンから選んでくださいね✨',
  
  PROCESSING: '🤖 コードを生成中です...\n\n少々お待ちください！\n最適なGASコードを作成しています✨\n\n完了したら通知しますので、しばらくお待ちください。',
  
  ERROR_SYSTEM: '🔧 一時的な問題が発生しました\n\n申し訳ございませんが、しばらく時間をおいてから再度お試しください。',
  
  ERROR_GENERATION: '😅 コード生成中にエラーが発生しました\n\n要求内容を確認して、もう一度詳細を教えていただけますでしょうか？',
  
  RATE_LIMITED: '⏰ しばらく時間をおいてから再度お試しください\n\n現在、多くのリクエストを処理中です。',
  
  SESSION_EXPIRED: '⏱️ セッションがタイムアウトしました\n\n最初からやり直してください。'
} as const

export const PROMPT_MESSAGES = {
  CATEGORY_SELECT: 'どんなGASコードを作りますか？\n下から選んでください👇',
  
  SUBCATEGORY_SELECT: (category: string) => `${category}ですね！\n\nどんな処理をしますか？`,
  
  DETAIL_INPUT: (category: string, subcategory?: string) => 
    `${subcategory || category}ですね！\n\n具体的にどんな処理をしたいか教えてください：`,
  
  RESTART: '🔄 新しいコードを作る',
  
  HELP: '❓ 使い方を見る'
} as const

export const SUCCESS_MESSAGES = {
  CODE_GENERATED: '🎉 コードが完成しました！',
  
  USAGE_INSTRUCTIONS: `💡 使い方：
1. Google スプレッドシートを開く
2. 拡張機能 > Apps Script をクリック
3. 上のコードをコピーして貼り付け
4. 保存して実行

🚀 このコードは安全にご利用いただけます！`
} as const

export const EXAMPLE_MESSAGES = {
  SPREADSHEET: [
    'Aシートの売上データを月別に集計したい',
    '複数シートのデータをまとめて1つのシートに転記したい',
    '条件に合うデータだけを別シートに抽出したい'
  ],
  
  GMAIL: [
    'スプレッドシートのデータを使って請求書メールを自動送信したい',
    '毎週金曜日に週報を自動送信したい',
    '特定の件名のメールを受信したらスプレッドシートに記録したい'
  ],
  
  CALENDAR: [
    'スプレッドシートの予定表からカレンダーに一括登録したい',
    '毎月の定期ミーティングを自動で設定したい',
    '来週の予定をスプレッドシートに出力したい'
  ],
  
  API: [
    '外部のWeb APIからデータを取得してスプレッドシートに保存したい',
    'スプレッドシートのデータを外部システムに自動送信したい',
    '定期的にAPIを呼び出してデータを更新したい'
  ]
} as const

export const BUTTON_LABELS = {
  SPREADSHEET: '📊 スプレッドシート操作',
  GMAIL: '📧 Gmail自動化',
  CALENDAR: '📅 カレンダー連携',
  API: '🔗 API連携',
  CUSTOM: '✨ その他',
  
  DATA_READ: '📖 データの読み取り',
  DATA_WRITE: '✏️ データの書き込み',
  DATA_TRANSFORM: '🔄 データの変換・加工',
  DATA_ANALYSIS: '📊 集計・分析',
  
  AUTO_SEND: '📮 メール自動送信',
  RECEIVE_PROCESS: '📬 メール受信処理',
  ATTACHMENT: '📎 添付ファイル処理',
  
  CREATE_EVENT: '📝 予定の作成',
  GET_EVENTS: '📖 予定の取得',
  REMINDER: '🔔 リマインダー設定',
  
  WEB_API: '🌐 Web API呼び出し',
  DATA_FETCH: '📊 データ取得・加工',
  AUTOMATION: '🔄 定期実行・自動化',
  
  DETAILED_EXPLANATION: '💬 詳しく説明する',
  NEW_REQUEST: '🔄 新しいコードを作る',
  HELP: '❓ 使い方を見る'
} as const