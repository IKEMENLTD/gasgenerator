export interface SubcategoryDefinition {
  id: string
  name: string
  icon: string
}

export interface CategoryDefinition {
  id: string
  name: string
  icon: string
  subcategories: SubcategoryDefinition[]
}

export const CATEGORY_DEFINITIONS: Record<string, CategoryDefinition> = {
  spreadsheet: {
    id: 'spreadsheet',
    name: 'スプレッドシート操作',
    icon: '📊',
    subcategories: [
      { id: 'data_read', name: 'データの読み取り', icon: '📖' },
      { id: 'data_write', name: 'データの書き込み', icon: '✏️' },
      { id: 'data_transform', name: 'データの変換・加工', icon: '🔄' },
      { id: 'data_analysis', name: '集計・分析', icon: '📊' }
    ]
  },
  gmail: {
    id: 'gmail',
    name: 'Gmail自動化',
    icon: '📧',
    subcategories: [
      { id: 'auto_send', name: 'メール自動送信', icon: '📮' },
      { id: 'receive_process', name: 'メール受信処理', icon: '📬' },
      { id: 'attachment', name: '添付ファイル処理', icon: '📎' }
    ]
  },
  calendar: {
    id: 'calendar',
    name: 'カレンダー連携',
    icon: '📅',
    subcategories: [
      { id: 'create_event', name: '予定の作成', icon: '📝' },
      { id: 'get_events', name: '予定の取得', icon: '📖' },
      { id: 'reminder', name: 'リマインダー設定', icon: '🔔' }
    ]
  },
  api: {
    id: 'api',
    name: 'API連携',
    icon: '🔗',
    subcategories: [
      { id: 'web_api', name: 'Web API呼び出し', icon: '🌐' },
      { id: 'data_fetch', name: 'データ取得・加工', icon: '📊' },
      { id: 'automation', name: '定期実行・自動化', icon: '🔄' }
    ]
  },
  custom: {
    id: 'custom',
    name: 'その他',
    icon: '✨',
    subcategories: []
  }
}

/**
 * カテゴリ名からIDを取得
 */
export function getCategoryIdByName(name: string): string | null {
  for (const [id, def] of Object.entries(CATEGORY_DEFINITIONS)) {
    if (def.name === name) {
      return id
    }
  }
  return null
}

/**
 * サブカテゴリ名からIDを取得
 */
export function getSubcategoryIdByName(categoryId: string, name: string): string | null {
  const category = CATEGORY_DEFINITIONS[categoryId]
  if (!category) return null

  for (const sub of category.subcategories) {
    if (sub.name === name) {
      return sub.id
    }
  }
  return null
}

/**
 * カテゴリが有効かチェック
 */
export function isValidCategory(categoryId: string): boolean {
  return categoryId in CATEGORY_DEFINITIONS
}