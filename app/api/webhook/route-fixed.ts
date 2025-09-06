import { NextRequest, NextResponse } from 'next/server'
import { LineWebhookValidator, recentEventCache } from '../../../lib/line/webhook-validator'
import { LineApiClient } from '../../../lib/line/client'
import { MessageTemplates } from '../../../lib/line/message-templates'
import { FlexTemplates } from '../../../lib/line/flex-templates'
import { UserQueries, SessionQueries, MetricsQueries } from '../../../lib/supabase/queries'
import { QueueManager } from '../../../lib/queue/manager'
import { createErrorResponse, createSuccessResponse, handleApiError, AppError, RateLimiter } from '../../../lib/utils/error-handler'
import { logger } from '../../../lib/utils/logger'
import { generateRequestId } from '../../../lib/utils/crypto'
import { RATE_LIMITS, TIMEOUTS } from '../../../lib/constants/config'
import { getCategoryIdByName, getSubcategoryIdByName, CATEGORY_DEFINITIONS } from '../../../lib/conversation/category-definitions'
import type { LineWebhookEvent } from '../../../types/line'
import type { MessageProcessResult } from '../../../types/conversation'

// エッジランタイム使用（高速化）
export const runtime = 'edge'
export const maxDuration = 10

const lineClient = new LineApiClient()

// セッション状態をメモリに保持（Supabaseエラー時のフォールバック）
const memorySessionStore = new Map<string, any>()

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()
  
  try {
    // 1. リクエストボディ取得
    const body = await req.text()
    const signature = req.headers.get('x-line-signature')

    logger.info('Webhook request received', { 
      requestId, 
      bodyLength: body.length,
      hasSignature: !!signature
    })

    // 2. Webhook検証
    const validation = await LineWebhookValidator.validate(body, signature, requestId)
    if (!validation.isValid) {
      return createErrorResponse('INVALID_SIGNATURE', validation.errorMessage!, requestId)
    }

    if (validation.events.length === 0) {
      return createSuccessResponse({ processed: 0, replied: 0, queued: 0 }, requestId)
    }

    // 3. 各イベントを処理
    const results: MessageProcessResult[] = []
    
    for (const event of validation.events) {
      // テキストメッセージのみ処理
      if (event.type !== 'message' || event.message?.type !== 'text') {
        continue
      }

      // 重複チェック
      const eventKey = `${event.source.userId}_${event.timestamp}`
      if (recentEventCache.has(eventKey)) {
        logger.info('Duplicate event detected, skipping', { eventKey })
        continue
      }
      recentEventCache.set(eventKey, true)
      
      // 30秒後に削除
      setTimeout(() => recentEventCache.delete(eventKey), 30000)

      // イベント処理
      try {
        const result = await processWebhookEvent(event, requestId)
        results.push(result)
        
        // 処理成功をログ
        logger.info('Event processed successfully', {
          requestId,
          userId: event.source.userId,
          result
        })
      } catch (error) {
        logger.error('Event processing failed', { 
          requestId, 
          userId: event.source.userId,
          error: error instanceof Error ? error.message : String(error)
        })
        
        // エラー時も200を返すために、エラーメッセージを送信
        try {
          if (event.replyToken) {
            await lineClient.replyMessage(
              event.replyToken,
              [MessageTemplates.createErrorMessage('system')] as any
            )
          }
        } catch (replyError) {
          logger.error('Failed to send error message', { replyError })
        }
        
        results.push({ replied: true, queued: false, sessionUpdated: false })
      }
    }

    const processingTime = Date.now() - startTime
    logger.info('Webhook processed', {
      requestId,
      eventsCount: results.length,
      processingTime
    })

    // 必ず200を返す（LINEの再送を防ぐ）
    return NextResponse.json({
      success: true,
      processed: results.length,
      timestamp: new Date().toISOString()
    }, { status: 200 })

  } catch (error) {
    logger.error('Webhook error', {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    })
    
    // エラーでも200を返す
    return NextResponse.json({
      success: false,
      error: 'Internal error',
      requestId,
      timestamp: new Date().toISOString()
    }, { status: 200 })
  }
}

/**
 * 個別イベント処理（簡略化＆エラーハンドリング強化）
 */
async function processWebhookEvent(
  event: LineWebhookEvent, 
  requestId: string
): Promise<MessageProcessResult> {
  const lineUserId = event.source.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken!

  logger.info('Processing message', { 
    requestId, 
    lineUserId, 
    messageText,
    replyToken: replyToken.substring(0, 10) + '...'
  })

  try {
    // メモリセッションを取得または作成
    let session = memorySessionStore.get(lineUserId) || {
      id: `session_${Date.now()}`,
      userId: lineUserId,
      currentStep: 0,
      category: null,
      subcategory: null,
      requirements: {}
    }

    // メッセージ内容に応じた処理
    if (messageText === '新しいコードを作りたい' || 
        messageText.includes('最初から') ||
        session.currentStep === 0) {
      
      // 新しいセッション開始
      session = {
        id: `session_${Date.now()}`,
        userId: lineUserId,
        currentStep: 1,
        category: null,
        subcategory: null,
        requirements: {}
      }
      memorySessionStore.set(lineUserId, session)
      
      // カテゴリ選択を促す
      await lineClient.replyMessage(replyToken, [
        {
          type: 'text',
          text: '「スプレッドシート操作」を選択しました。\n具体的な内容を選んでください：',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📖 データ読み取り', text: 'データの読み取り' }},
              { type: 'action', action: { type: 'message', label: '✏️ データ書き込み', text: 'データの書き込み' }},
              { type: 'action', action: { type: 'message', label: '🔄 データ変換', text: 'データの変換・加工' }},
              { type: 'action', action: { type: 'message', label: '📊 集計・分析', text: '集計・分析' }},
              { type: 'action', action: { type: 'message', label: '📝 詳しく説明', text: '詳しく説明したい' }}
            ]
          }
        }
      ])
      
      return { replied: true, queued: false, sessionUpdated: true }
    }

    // ステップ1: カテゴリ選択
    if (session.currentStep === 1) {
      const categoryId = getCategoryIdByName(messageText)
      
      if (!categoryId) {
        // カテゴリが不明な場合は再選択
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: 'カテゴリを選択してください：',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
              { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
              { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }}
            ]
          }
        }])
        return { replied: true, queued: false, sessionUpdated: false }
      }
      
      // カテゴリを保存して次のステップへ
      session.category = categoryId
      session.currentStep = 2
      session.requirements.category = messageText
      memorySessionStore.set(lineUserId, session)
      
      // サブカテゴリ選択を送信
      const response = MessageTemplates.createSubcategorySelection(categoryId)
      await lineClient.replyMessage(replyToken, [response])
      
      return { replied: true, queued: false, sessionUpdated: true }
    }

    // ステップ2: サブカテゴリ選択
    if (session.currentStep === 2) {
      session.subcategory = messageText
      session.currentStep = 3
      session.requirements.subcategory = messageText
      memorySessionStore.set(lineUserId, session)
      
      // 詳細入力を促す
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: `${messageText}の処理を作成します。\n\n詳しい要件を教えてください：\n\n例：「A列の売上データを月別に集計して、結果をB列に出力したい」`
      }])
      
      return { replied: true, queued: false, sessionUpdated: true }
    }

    // ステップ3: 詳細入力
    if (session.currentStep === 3) {
      if (messageText.length < 10) {
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '詳細をもう少し詳しく教えてください（10文字以上）'
        }])
        return { replied: true, queued: false, sessionUpdated: false }
      }
      
      // セッションをリセット
      memorySessionStore.delete(lineUserId)
      
      // 処理中メッセージを送信
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '🔄 コードを生成中です...\nしばらくお待ちください（1-2分）'
      }])
      
      // キューに追加（エラーハンドリングを強化）
      try {
        await QueueManager.addJob({
          userId: lineUserId,
          lineUserId,
          sessionId: session.id,
          category: session.category,
          subcategory: session.subcategory,
          requirements: {
            ...session.requirements,
            details: messageText
          }
        })
      } catch (queueError) {
        logger.error('Queue error', { queueError })
      }
      
      return { replied: true, queued: true, sessionUpdated: true }
    }

    // 不明な状態の場合は最初から
    memorySessionStore.delete(lineUserId)
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '最初からやり直します。\nカテゴリを選択してください：',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
          { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
          { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
          { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
          { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }}
        ]
      }
    }])
    
    return { replied: true, queued: false, sessionUpdated: true }

  } catch (error) {
    logger.error('Message processing error', { 
      requestId, 
      lineUserId, 
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    service: 'GAS Generator Webhook',
    timestamp: new Date().toISOString()
  })
}