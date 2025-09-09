import { SessionHandler } from './session-handler'
import { LineApiClient } from '@/lib/line/client'
import { MessageTemplates } from '@/lib/line/message-templates'
import { getCategoryIdByName, getSubcategoryIdByName, CATEGORY_DEFINITIONS } from './category-definitions'
import { sanitizeUserInput } from '@/lib/utils/validators'
import { logger } from '@/lib/utils/logger'
import { CONVERSATION_CONFIG } from '@/lib/constants/config'
import type { MessageProcessResult, ConversationInput } from '@/types/conversation'
import type { LineWebhookEvent } from '@/types/line'

export class ConversationFlowManager {
  private lineClient: LineApiClient

  constructor() {
    this.lineClient = new LineApiClient()
  }

  /**
   * Webhookイベントを処理
   */
  async processWebhookEvent(event: LineWebhookEvent, requestId: string): Promise<MessageProcessResult> {
    const lineUserId = event.source.userId
    const messageText = sanitizeUserInput(event.message?.text || '')
    const replyToken = event.replyToken!

    logger.debug('Processing conversation event', { 
      requestId, 
      lineUserId, 
      messageText: messageText.substring(0, 100) 
    })

    try {
      // 会話リセットのトリガーワード
      if (this.isResetTrigger(messageText)) {
        return await this.handleConversationReset(lineUserId, replyToken, requestId)
      }

      // 現在の会話状態を取得
      const currentState = await SessionHandler.getCurrentState(lineUserId)

      if (!currentState) {
        // 新規会話開始
        return await this.handleNewConversation(lineUserId, replyToken, requestId)
      }

      // ステップに応じた処理
      switch (currentState.currentStep) {
        case 1:
          return await this.handleCategorySelection(currentState, messageText, replyToken, requestId)
        
        case 2:
          return await this.handleSubcategorySelection(currentState, messageText, replyToken, requestId)
        
        case 3:
          return await this.handleDetailInput(currentState, messageText, replyToken, lineUserId, requestId)
        
        default:
          logger.warn('Invalid conversation step', { 
            lineUserId, 
            step: currentState.currentStep 
          })
          return await this.handleConversationReset(lineUserId, replyToken, requestId)
      }

    } catch (error) {
      logger.error('Conversation processing error', { 
        requestId, 
        lineUserId, 
        error 
      })
      
      // エラー時は一般的なエラーメッセージを返信
      await this.lineClient.replyMessage(replyToken, [
        MessageTemplates.createErrorMessage('system') as any
      ])
      
      return { replied: true, queued: false, sessionUpdated: false }
    }
  }

  /**
   * リセットトリガーかチェック
   */
  private isResetTrigger(messageText: string): boolean {
    const resetTriggers = [
      '新しいコードを作りたい',
      '新しいコード',
      '最初から',
      'リセット',
      'やり直し',
      'スタート'
    ]

    return resetTriggers.some(trigger => 
      messageText.includes(trigger)
    )
  }

  /**
   * 新規会話開始
   */
  private async handleNewConversation(
    lineUserId: string, 
    replyToken: string, 
    requestId: string
  ): Promise<MessageProcessResult> {
    // プロフィール取得（可能であれば）
    const profile = await this.lineClient.getUserProfile(lineUserId)
    
    // 新しいセッション開始
    await SessionHandler.startNewSession(lineUserId, profile?.displayName)
    
    // ウェルカムメッセージ送信
    await this.lineClient.replyMessage(replyToken, [
      MessageTemplates.createWelcomeMessage() as any
    ])

    logger.info('New conversation started', { lineUserId, requestId })
    
    return { replied: true, queued: false, sessionUpdated: true }
  }

  /**
   * 会話リセット
   */
  private async handleConversationReset(
    lineUserId: string, 
    replyToken: string, 
    requestId: string
  ): Promise<MessageProcessResult> {
    // 現在のセッションがあれば完了
    const currentState = await SessionHandler.getCurrentState(lineUserId)
    if (currentState) {
      await SessionHandler.completeSession(currentState.sessionId)
    }

    return await this.handleNewConversation(lineUserId, replyToken, requestId)
  }

  /**
   * カテゴリ選択処理（Step 1）
   */
  private async handleCategorySelection(
    currentState: any,
    messageText: string,
    replyToken: string,
    requestId: string
  ): Promise<MessageProcessResult> {
    const categoryId = getCategoryIdByName(messageText)
    
    if (!categoryId) {
      // 無効なカテゴリ - 再選択を促す
      await this.lineClient.replyMessage(replyToken, [
        MessageTemplates.createCategorySelection() as any
      ])
      
      logger.debug('Invalid category selected', { messageText, requestId })
      return { replied: true, queued: false, sessionUpdated: false }
    }

    // セッション更新（Step 2へ）
    await SessionHandler.advanceStep(currentState.sessionId, {
      step: 2,
      category: categoryId,
      additionalRequirements: { step1: messageText }
    })

    // 次のステップのメッセージ送信
    if (categoryId === 'custom') {
      // その他の場合は直接詳細入力へ
      await SessionHandler.advanceStep(currentState.sessionId, { step: 3 })
      await this.lineClient.replyMessage(replyToken, [
        MessageTemplates.createDetailInputPrompt('その他')
      ])
    } else {
      // サブカテゴリ選択
      await this.lineClient.replyMessage(replyToken, [
        MessageTemplates.createSubcategorySelection(categoryId)
      ])
    }

    logger.debug('Category selected', { categoryId, requestId })
    return { replied: true, queued: false, sessionUpdated: true }
  }

  /**
   * サブカテゴリ選択処理（Step 2）
   */
  private async handleSubcategorySelection(
    currentState: any,
    messageText: string,
    replyToken: string,
    requestId: string
  ): Promise<MessageProcessResult> {
    const categoryId = currentState.category
    const category = CATEGORY_DEFINITIONS[categoryId]
    
    if (!category) {
      logger.error('Invalid category in session', { categoryId, requestId })
      throw new Error(`Invalid category: ${categoryId}`)
    }

    let subcategoryId: string | null = null
    
    // 「詳しく説明したい」の場合
    if (messageText.includes('詳しく説明')) {
      subcategoryId = 'detailed'
    } else {
      subcategoryId = getSubcategoryIdByName(categoryId, messageText)
    }

    if (!subcategoryId) {
      // 無効なサブカテゴリ - 再選択を促す
      await this.lineClient.replyMessage(replyToken, [
        MessageTemplates.createSubcategorySelection(categoryId)
      ])
      
      logger.debug('Invalid subcategory selected', { messageText, categoryId, requestId })
      return { replied: true, queued: false, sessionUpdated: false }
    }

    // セッション更新（Step 3へ）
    await SessionHandler.advanceStep(currentState.sessionId, {
      step: 3,
      subcategory: subcategoryId === 'detailed' ? undefined : subcategoryId,
      additionalRequirements: {
        ...currentState.requirements,
        step2: messageText
      }
    })

    // 詳細入力プロンプト送信
    await this.lineClient.replyMessage(replyToken, [
      MessageTemplates.createDetailInputPrompt(
        category.name,
        subcategoryId === 'detailed' ? undefined : messageText
      )
    ])

    logger.debug('Subcategory selected', { subcategoryId, requestId })
    return { replied: true, queued: false, sessionUpdated: true }
  }

  /**
   * 詳細入力処理（Step 3）
   */
  private async handleDetailInput(
    currentState: any,
    messageText: string,
    replyToken: string,
    lineUserId: string,
    requestId: string
  ): Promise<MessageProcessResult> {
    
    // 最小文字数チェック
    if (messageText.length < CONVERSATION_CONFIG.MIN_DETAILS_LENGTH) {
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `詳細をもう少し詳しく教えてください（${CONVERSATION_CONFIG.MIN_DETAILS_LENGTH}文字以上）`
      }])
      
      return { replied: true, queued: false, sessionUpdated: false }
    }

    // 最大文字数チェック
    if (messageText.length > CONVERSATION_CONFIG.MAX_REQUIREMENTS_LENGTH) {
      await this.lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `申し訳ありませんが、詳細説明は${CONVERSATION_CONFIG.MAX_REQUIREMENTS_LENGTH}文字以内でお願いします。`
      }])
      
      return { replied: true, queued: false, sessionUpdated: false }
    }

    // 最終要件をまとめる
    const finalRequirements = {
      ...currentState.requirements,
      step3: messageText,
      details: messageText,
      category: currentState.category,
      subcategory: currentState.subcategory,
      lineUserId: lineUserId
    }

    // セッションを生成準備完了状態に更新
    await SessionHandler.markReadyForGeneration(currentState.sessionId, finalRequirements)

    // キューに追加
    const QueueQueries = (await import('@/lib/supabase/queue-queries')).QueueQueries
    await QueueQueries.addToQueue({
      user_id: lineUserId,
      category: currentState.category,
      requirements: finalRequirements,
      status: 'pending'
    })

    // 処理中メッセージ送信
    await this.lineClient.replyMessage(replyToken, [
      MessageTemplates.createProcessingMessage() as any
    ])

    logger.info('Detail input completed, queued for generation', { 
      sessionId: currentState.sessionId,
      category: currentState.category,
      subcategory: currentState.subcategory,
      detailsLength: messageText.length,
      requestId
    })

    return { replied: true, queued: true, sessionUpdated: true }
  }

  /**
   * 会話フローの健全性チェック
   */
  async healthCheck(): Promise<{ healthy: boolean; issues: string[] }> {
    const issues: string[] = []

    try {
      // LINE API接続テスト
      const lineHealthy = await this.lineClient.testConnection()
      if (!lineHealthy) {
        issues.push('LINE API connection failed')
      }

      // データベース接続テスト
      const supabase = (await import('@/lib/supabase/client')).supabaseAdmin
      const { error: dbError } = await supabase.from('users').select('id').limit(1)
      if (dbError) {
        issues.push('Database connection failed')
      }

    } catch (error) {
      issues.push(`Health check failed: ${error}`)
    }

    return {
      healthy: issues.length === 0,
      issues
    }
  }
}

// デフォルトインスタンス
export const conversationFlow = new ConversationFlowManager()