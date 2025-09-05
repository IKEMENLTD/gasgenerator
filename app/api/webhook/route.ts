import { NextRequest, NextResponse } from 'next/server'
import { LineWebhookValidator, recentEventCache } from '../../../lib/line/webhook-validator'
import { LineApiClient } from '../../../lib/line/client'
import { MessageTemplates } from '../../../lib/line/message-templates'
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

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()
  
  try {
    // メトリクス記録用
    const recordMetric = (metricType: string, value: number, metadata?: any) => {
      MetricsQueries.recordMetric({ 
        metric_type: metricType, 
        metric_value: value, 
        metadata 
      }).catch(err => logger.error('Failed to record metric', { err }))
    }

    // 1. リクエストボディ取得
    const body = await req.text()
    const signature = req.headers.get('x-line-signature')

    logger.info('Webhook request received', { 
      requestId, 
      bodyLength: body.length,
      hasSignature: !!signature
    })

    // 2. レート制限チェック
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown'
    const globalRateCheck = RateLimiter.checkLimit(
      'global', 
      RATE_LIMITS.GLOBAL_PER_MINUTE, 
      60 * 1000
    )

    if (!globalRateCheck.allowed) {
      recordMetric('rate_limit_global', 1, { ip: clientIp })
      return createErrorResponse(
        'RATE_LIMITED', 
        'Global rate limit exceeded', 
        requestId,
        globalRateCheck.retryAfter
      )
    }

    // 3. Webhook検証
    const validation = await LineWebhookValidator.validate(body, signature, requestId)
    if (!validation.isValid) {
      recordMetric('webhook_validation_failed', 1, { error: validation.errorMessage })
      return createErrorResponse('INVALID_SIGNATURE', validation.errorMessage!, requestId)
    }

    if (validation.events.length === 0) {
      logger.info('No processable events', { requestId })
      return createSuccessResponse({ processed: 0, replied: 0, queued: 0 }, requestId)
    }

    // 4. 各イベントを処理
    const results: MessageProcessResult[] = []
    
    for (const event of validation.events) {
      // 重複チェック
      if (LineWebhookValidator.isDuplicateEvent(event, recentEventCache)) {
        continue
      }

      // ユーザー単位のレート制限
      const userRateCheck = RateLimiter.checkLimit(
        event.source.userId,
        RATE_LIMITS.PER_USER_PER_HOUR,
        60 * 60 * 1000
      )

      if (!userRateCheck.allowed) {
        await lineClient.replyMessage(
          event.replyToken!,
          [MessageTemplates.createRateLimitMessage(userRateCheck.retryAfter!)] as any
        )
        recordMetric('rate_limit_user', 1, { userId: event.source.userId })
        continue
      }

      // イベント処理
      try {
        const result = await processWebhookEvent(event, requestId)
        results.push(result)
      } catch (error) {
        logger.error('Event processing failed', { 
          requestId, 
          userId: event.source.userId,
          error 
        })
        
        // エラー時も返信（LINEユーザーが混乱しないように）
        await lineClient.replyMessage(
          event.replyToken!,
          [MessageTemplates.createErrorMessage('system')] as any
        )
        
        results.push({ replied: true, queued: false, sessionUpdated: false })
        recordMetric('event_processing_failed', 1, { userId: event.source.userId })
      }
    }

    const processingTime = Date.now() - startTime
    
    // メトリクス記録
    recordMetric('webhook_response_time', processingTime, { endpoint: '/api/webhook' })
    recordMetric('webhook_events_processed', results.length)

    logger.info('Webhook processed successfully', {
      requestId,
      eventsCount: results.length,
      processingTime,
      repliedCount: results.filter(r => r.replied).length,
      queuedCount: results.filter(r => r.queued).length
    })

    return createSuccessResponse({
      processed: results.length,
      replied: results.filter(r => r.replied).length,
      queued: results.filter(r => r.queued).length
    }, requestId)

  } catch (error) {
    const processingTime = Date.now() - startTime
    
    logger.error('Webhook error', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
      processingTime
    })
    
    // LINEの再送を防ぐため、必ず200で返す
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Processing failed'
      },
      timestamp: new Date().toISOString(),
      requestId
    })
  }
}

/**
 * 個別イベント処理
 */
async function processWebhookEvent(
  event: LineWebhookEvent, 
  requestId: string
): Promise<MessageProcessResult> {
  const lineUserId = event.source.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken!

  logger.debug('Processing event', { requestId, lineUserId, messageText })

  try {
    // 1. ユーザー取得または作成
    const user = await UserQueries.createOrUpdate(lineUserId)
    
    // 2. アクティブセッション確認
    let session = await SessionQueries.findActiveSession(user.id)
    
    // 3. メッセージ内容に応じた処理
    if (!session || messageText === '新しいコードを作りたい' || messageText.includes('最初から')) {
      // 新しい会話開始
      if (session) {
        await SessionQueries.completeSession(session.id)
      }
      
      session = await SessionQueries.createSession(user.id, { status: 'active' })
      
      await lineClient.replyMessage(replyToken, [MessageTemplates.createWelcomeMessage()])
      
      return { replied: true, queued: false, sessionUpdated: true }
    }

    // 4. 会話ステップに応じた処理
    const currentStep = session.current_step

    if (currentStep === 1) {
      // カテゴリ選択段階
      return await handleCategorySelection(user.id, session.id, messageText, replyToken)
      
    } else if (currentStep === 2) {
      // サブカテゴリ選択段階
      return await handleSubcategorySelection(user.id, session, messageText, replyToken)
      
    } else if (currentStep === 3) {
      // 詳細入力段階
      return await handleDetailInput(user.id, session, messageText, replyToken, lineUserId)
    }

    // 予期しない状態の場合は最初から
    await SessionQueries.completeSession(session.id)
    const newSession = await SessionQueries.createSession(user.id, { status: 'active' })
    
    await lineClient.replyMessage(replyToken, [MessageTemplates.createWelcomeMessage()])
    
    return { replied: true, queued: false, sessionUpdated: true }

  } catch (error) {
    logger.error('Event processing error', { requestId, lineUserId, error })
    throw error
  }
}

/**
 * カテゴリ選択処理
 */
async function handleCategorySelection(
  userId: string, 
  sessionId: string, 
  messageText: string, 
  replyToken: string
): Promise<MessageProcessResult> {
  const categoryId = getCategoryIdByName(messageText)
  
  if (!categoryId) {
    // 無効なカテゴリの場合は再度選択を促す
    await lineClient.replyMessage(replyToken, [MessageTemplates.createCategorySelection()])
    return { replied: true, queued: false, sessionUpdated: false }
  }

  // セッション更新
  await SessionQueries.updateSession(sessionId, {
    current_step: 2,
    category: categoryId,
    collected_requirements: { step1: messageText }
  })

  // サブカテゴリ選択メッセージ送信
  if (categoryId === 'custom') {
    // その他の場合は直接詳細入力へ
    await SessionQueries.updateSession(sessionId, { current_step: 3 })
    await lineClient.replyMessage(replyToken, [
      MessageTemplates.createDetailInputPrompt('その他')
    ])
  } else {
    await lineClient.replyMessage(replyToken, [
      MessageTemplates.createSubcategorySelection(categoryId)
    ])
  }

  return { replied: true, queued: false, sessionUpdated: true }
}

/**
 * サブカテゴリ選択処理
 */
async function handleSubcategorySelection(
  userId: string,
  session: any,
  messageText: string,
  replyToken: string
): Promise<MessageProcessResult> {
  const categoryId = session.category
  const category = CATEGORY_DEFINITIONS[categoryId]
  
  if (!category) {
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
    // 無効なサブカテゴリの場合は再度選択を促す
    await lineClient.replyMessage(replyToken, [
      MessageTemplates.createSubcategorySelection(categoryId)
    ])
    return { replied: true, queued: false, sessionUpdated: false }
  }

  // セッション更新（ステップ3へ）
  await SessionQueries.updateSession(session.id, {
    current_step: 3,
    subcategory: subcategoryId === 'detailed' ? null : subcategoryId,
    collected_requirements: {
      ...session.collected_requirements,
      step2: messageText
    }
  })

  // 詳細入力プロンプト送信
  await lineClient.replyMessage(replyToken, [
    MessageTemplates.createDetailInputPrompt(category.name, 
      subcategoryId === 'detailed' ? undefined : messageText
    )
  ])

  return { replied: true, queued: false, sessionUpdated: true }
}

/**
 * 詳細入力処理（キューに追加）
 */
async function handleDetailInput(
  userId: string,
  session: any,
  messageText: string,
  replyToken: string,
  lineUserId: string
): Promise<MessageProcessResult> {
  
  if (messageText.length < 10) {
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '詳細をもう少し詳しく教えてください（10文字以上）'
    }])
    return { replied: true, queued: false, sessionUpdated: false }
  }

  // セッションを完了状態に更新
  await SessionQueries.updateSession(session.id, {
    status: 'ready_for_generation',
    collected_requirements: {
      ...session.collected_requirements,
      step3: messageText,
      details: messageText
    }
  })

  // キューに追加してバックグラウンド処理開始
  try {
    const job = await QueueManager.addJob({
      userId,
      lineUserId,
      sessionId: session.id,
      category: session.category,
      subcategory: session.subcategory,
      requirements: {
        category: session.category,
        subcategory: session.subcategory,
        details: messageText
      },
      userHistory: session.collected_requirements
    })
    
    logger.info('Job added to queue', { 
      jobId: job.id,
      userId,
      sessionId: session.id
    })
    
  } catch (queueError) {
    logger.error('Failed to add job to queue', { 
      userId,
      sessionId: session.id,
      queueError 
    })
    
    // キューエラーの場合は直接処理を試行
    await lineClient.replyMessage(replyToken, [
      MessageTemplates.createErrorMessage('system')
    ])
    
    return { replied: true, queued: false, sessionUpdated: true }
  }

  // 処理中メッセージ送信
  await lineClient.replyMessage(replyToken, [MessageTemplates.createProcessingMessage()])

  logger.info('Code generation queued', { 
    userId,
    sessionId: session.id,
    category: session.category,
    subcategory: session.subcategory,
    detailsLength: messageText.length
  })

  return { replied: true, queued: true, sessionUpdated: true }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    service: 'GAS Generator Webhook',
    timestamp: new Date().toISOString()
  })
}