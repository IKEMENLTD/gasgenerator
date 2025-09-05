// 会話フロー関連の型定義

// カテゴリ・サブカテゴリ定義
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

// 会話ステップ
export type ConversationStep = 1 | 2 | 3

export interface ConversationState {
  userId: string
  sessionId: string
  currentStep: ConversationStep
  category?: string
  subcategory?: string
  requirements: Record<string, any>
  status: 'active' | 'ready_for_generation' | 'completed' | 'abandoned'
}

// メッセージ処理結果
export interface MessageProcessResult {
  replied: boolean
  queued: boolean
  nextStep?: ConversationStep
  sessionUpdated: boolean
}

// カテゴリ選択
export interface CategorySelection {
  type: 'category'
  category: string
}

// サブカテゴリ選択
export interface SubcategorySelection {
  type: 'subcategory'
  subcategory: string
}

// 詳細入力
export interface DetailInput {
  type: 'detail'
  details: string
}

// メッセージの種類
export type ConversationInput = CategorySelection | SubcategorySelection | DetailInput

// フロー管理
export interface FlowManager {
  processMessage(
    lineUserId: string,
    message: string
  ): Promise<MessageProcessResult>
  
  resetSession(lineUserId: string): Promise<void>
  
  getSessionStatus(lineUserId: string): Promise<ConversationState | null>
}

// メッセージテンプレート
export interface MessageTemplate {
  createCategorySelection(): any
  createSubCategorySelection(categoryKey: string): any
  createDetailPrompt(categoryName: string, subcategoryName?: string): any
  createProcessingMessage(): any
  createCodeResult(summary: string, explanation: string, code: string): any[]
  createErrorMessage(errorType?: 'system' | 'generation'): any
}

// 会話履歴（簡易版）
export interface ConversationHistory {
  category: string
  subcategory?: string
  success: boolean
  timestamp: string
}