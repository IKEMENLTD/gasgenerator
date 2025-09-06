import { NextRequest, NextResponse } from 'next/server'
import { LineApiClient } from '../../../lib/line/client'
import { MessageTemplates } from '../../../lib/line/message-templates'
import { QueueManager } from '../../../lib/queue/manager'
import { UserQueries } from '../../../lib/supabase/queries'
import { logger } from '../../../lib/utils/logger'
import { generateRequestId, generateUUID } from '../../../lib/utils/crypto'
import { getCategoryIdByName } from '../../../lib/conversation/category-definitions'
import { ConversationalFlow, ConversationContext } from '../../../lib/conversation/conversational-flow'
import { ConversationSessionStore } from '../../../lib/conversation/session-store'
import { LineImageHandler } from '../../../lib/line/image-handler'
import { rateLimiters } from '../../../lib/middleware/rate-limiter'

// Node.jsランタイムを使用（AI処理のため）
export const runtime = 'nodejs'
export const maxDuration = 30  // Webhookは30秒で応答

const lineClient = new LineApiClient()
const sessionStore = ConversationSessionStore.getInstance()
const imageHandler = new LineImageHandler()

// 重複イベント検出用のメモリキャッシュ（メモリリーク対策付き）
const recentEventKeys = new Map<string, number>()
const MAX_CACHE_SIZE = 20 // メモリ節約のため20に制限
const CACHE_TTL = 10000 // 10秒に短縮

// キャッシュクリーンアップ関数（setIntervalは使わない）
function cleanupCache() {
  const now = Date.now()
  const keysToDelete: string[] = []
  
  for (const [key, timestamp] of recentEventKeys.entries()) {
    if (now - timestamp > CACHE_TTL) {
      keysToDelete.push(key)
    }
  }
  
  keysToDelete.forEach(key => recentEventKeys.delete(key))
  
  // キャッシュサイズが大きすぎる場合は古いものから削除
  if (recentEventKeys.size > MAX_CACHE_SIZE) {
    const entries = Array.from(recentEventKeys.entries())
      .sort((a, b) => a[1] - b[1])
    
    const toRemove = entries.slice(0, entries.length - MAX_CACHE_SIZE)
    toRemove.forEach(([key]) => recentEventKeys.delete(key))
  }
}

/**
 * LINE Webhook エンドポイント
 */
export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  const startTime = Date.now()
  
  try {
    // レート制限チェック
    const rateLimitResult = await rateLimiters.webhook.check(req)
    if (rateLimitResult) return rateLimitResult
    
    // 1. リクエスト取得と基本検証
    const body = await req.text()
    const signature = req.headers.get('x-line-signature')
    
    if (!signature) {
      logger.warn('No signature provided', { requestId })
      return NextResponse.json({ error: 'No signature' }, { status: 200 })
    }

    // 2. 署名検証
    if (!(await validateSignature(body, signature))) {
      logger.warn('Invalid signature', { requestId })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 200 })
    }

    // 3. ボディをパース
    let parsedBody: any
    try {
      parsedBody = JSON.parse(body)
    } catch (e) {
      logger.error('Invalid JSON body', { requestId })
      return NextResponse.json({ error: 'Invalid body' }, { status: 200 })
    }

    logger.info('Webhook received', { 
      requestId, 
      eventCount: parsedBody.events?.length || 0 
    })

    // 4. イベント処理
    const events = parsedBody.events || []
    let processedCount = 0
    
    for (const event of events) {
      try {
        // イベントタイプごとに処理
        if (event.type === 'message') {
          if (event.message?.type === 'text') {
            // テキストメッセージ処理
            if (await processTextMessage(event, requestId)) {
              processedCount++
            }
          } else if (event.message?.type === 'image') {
            // 画像メッセージ処理
            if (await processImageMessage(event, requestId)) {
              processedCount++
            }
          } else if (event.message?.type === 'file') {
            // ファイルメッセージ処理
            if (await processFileMessage(event, requestId)) {
              processedCount++
            }
          }
        } else if (event.type === 'follow') {
          // フォローイベント処理
          await handleFollowEvent(event)
        } else if (event.type === 'unfollow') {
          // アンフォローイベント処理  
          await handleUnfollowEvent(event)
        } else {
          logger.debug('Skipping event', { type: event.type })
        }
      } catch (eventError) {
        logger.error('Event processing error', { 
          requestId,
          eventType: event.type,
          error: eventError instanceof Error ? eventError.message : String(eventError)
        })
      }
    }

    const processingTime = Date.now() - startTime
    logger.info('Webhook processed', {
      requestId,
      processedCount,
      processingTime
    })

    return NextResponse.json({ 
      success: true,
      processed: processedCount,
      time: processingTime
    }, { status: 200 })

  } catch (error) {
    logger.error('Webhook error', { 
      requestId, 
      error: error instanceof Error ? error.message : String(error)
    })
    
    // LINEの再送を防ぐため必ず200を返す
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

/**
 * 署名検証（Web Crypto API使用）
 */
async function validateSignature(body: string, signature: string): Promise<boolean> {
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET || ''
    
    // Web Crypto APIを使用
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(channelSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    )
    
    // Base64エンコード
    const base64 = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    
    return base64 === signature
  } catch (error) {
    logger.error('Signature validation error', { error })
    return false
  }
}

/**
 * テキストメッセージ処理
 */
async function processTextMessage(event: any, requestId: string): Promise<boolean> {
  const userId = event.source?.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken
  
  if (!userId || !replyToken) {
    logger.warn('Missing required fields', { userId, hasReplyToken: !!replyToken })
    return false
  }

  // 重複チェック
  if (isDuplicateEvent(userId, event.timestamp)) {
    logger.info('Duplicate event detected', { userId })
    return false
  }

  logger.info('Processing message', { userId, messageText, requestId })

  try {
    // 会話コンテキスト取得
    let context = sessionStore.get(userId)

    // リセットコマンド
    if (isResetCommand(messageText)) {
      sessionStore.delete(userId)
      context = null
    }

    // 新規会話開始
    if (!context) {
      return await startNewConversation(userId, messageText, replyToken)
    }

    // 既存会話の継続
    return await continueConversation(userId, context, messageText, replyToken)
    
  } catch (error) {
    logger.error('Message processing error', { 
      userId, 
      error: error instanceof Error ? error.message : String(error) 
    })
    
    // エラー時の返信
    try {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '申し訳ございません。エラーが発生しました。\n「最初から」と入力してやり直してください。'
      }])
    } catch (replyError) {
      logger.error('Failed to send error reply', { replyError })
    }
    
    // エラー時はコンテキストをクリア
    sessionStore.delete(userId)
    return false
  }
}

/**
 * 重複イベント検出
 */
function isDuplicateEvent(userId: string, timestamp: number): boolean {
  const eventKey = `${userId}_${timestamp}`
  const now = Date.now()
  
  // キャッシュクリーンアップ
  if (recentEventKeys.size > MAX_CACHE_SIZE) {
    // 古いエントリを削除
    for (const [key, time] of recentEventKeys.entries()) {
      if (now - time > CACHE_TTL) {
        recentEventKeys.delete(key)
      }
    }
  }
  
  // 重複チェック
  if (recentEventKeys.has(eventKey)) {
    return true
  }
  
  // キャッシュに追加
  recentEventKeys.set(eventKey, now)
  
  // TTL後に自動削除
  setTimeout(() => recentEventKeys.delete(eventKey), CACHE_TTL)
  
  return false
}

/**
 * リセットコマンドかどうか判定
 */
function isResetCommand(text: string): boolean {
  const resetCommands = ['リセット', '最初から', '新しいコードを作りたい', 'reset', 'restart']
  return resetCommands.some(cmd => text.toLowerCase().includes(cmd))
}

/**
 * 新規会話開始
 */
async function startNewConversation(
  userId: string, 
  messageText: string, 
  replyToken: string
): Promise<boolean> {
  // カテゴリ判定
  const categoryId = getCategoryIdByName(messageText)
  
  if (!categoryId) {
    // カテゴリ選択画面を表示
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '👋 こんにちは！GASコードを自動生成します。\n\n作りたいコードのカテゴリを選んでください：',
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
    return true
  }

  // 新しい会話コンテキスト作成
  const context = ConversationalFlow.resetConversation(categoryId)
  sessionStore.set(userId, context)
  
  // 最初の質問を送信
  const result = await ConversationalFlow.processConversation(context, messageText)
  sessionStore.set(userId, result.updatedContext)
  
  await lineClient.replyMessage(replyToken, [{
    type: 'text',
    text: result.reply,
    quickReply: {
      items: [
        { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }}
      ]
    }
  }])
  
  return true
}

/**
 * 既存会話の継続
 */
async function continueConversation(
  userId: string,
  context: ConversationContext,
  messageText: string,
  replyToken: string
): Promise<boolean> {
  // コード生成確認段階
  if (context.readyForCode) {
    if (messageText === 'はい' || messageText.includes('生成') || messageText === 'OK') {
      // コード生成開始
      await startCodeGeneration(userId, context, replyToken)
      sessionStore.delete(userId)
      return true
    } else if (messageText === '修正' || messageText === 'やり直し') {
      // 要件の修正
      context.readyForCode = false
      sessionStore.set(userId, context)
      
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: 'どの部分を修正したいですか？詳しく教えてください。'
      }])
      return true
    }
  }

  // 会話継続
  try {
    const result = await ConversationalFlow.processConversation(context, messageText)
    sessionStore.set(userId, result.updatedContext)

    // 応答送信
    const quickReplyItems = result.isComplete ? [
      { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい' }},
      { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' }},
      { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }}
    ] : [
      { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }}
    ]

    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: result.reply,
      quickReply: { items: quickReplyItems as any }
    }])
    
    return true
    
  } catch (error) {
    // AIエラー時のフォールバック
    logger.error('Conversation processing error', { error })
    
    await lineClient.replyMessage(replyToken, [{
      type: 'text',  
      text: 'もう少し詳しく教えていただけますか？\n\nどのような処理を自動化したいですか？'
    }])
    
    return true
  }
}

/**
 * コード生成開始
 */
async function startCodeGeneration(
  userId: string,
  context: ConversationContext,
  replyToken: string
): Promise<void> {
  try {
    // ローディングアニメーションを開始（30秒）
    await lineClient.showLoadingAnimation(userId, 30)
    
    // キューに追加
    await QueueManager.addJob({
      userId: userId,  // LINE User IDを使用（外部キー制約を回避）
      lineUserId: userId,  // LINE User IDも保存
      sessionId: generateUUID(),
      category: context.category,
      subcategory: 'conversational',
      requirements: {
        conversation: context.messages,
        extractedRequirements: context.requirements,
        prompt: ConversationalFlow.generateCodePrompt(context)
      }
    })

    // 確認メッセージを送信
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '🚀 承知しました！\n\nコードを生成中です...\n\n✅ キューに追加済み\n⏰ 予想時間：2-3分\n\n生成が完了したら自動で通知します！\n\n※ 処理中はローディングが表示されます'
    }])
    
  } catch (error) {
    logger.error('Queue error', { error })
    
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '申し訳ございません。システムエラーが発生しました。\nもう一度お試しください。'
    }])
  }
}

/**
 * フォローイベント処理
 */
async function handleFollowEvent(event: any): Promise<void> {
  const userId = event.source?.userId
  if (!userId) return
  
  logger.info('New follower', { userId })
  
  try {
    // ユーザー作成・更新
    const user = await UserQueries.createOrUpdate(userId)
    
    // 既にプレミアムユーザーかチェック
    const isPremium = user?.subscription_status === 'premium' && 
                     user?.subscription_end_date && 
                     new Date(user.subscription_end_date) > new Date()
    
    if (isPremium) {
      // プレミアムユーザーには通常のウェルカムメッセージ
      await lineClient.pushMessage(userId, [{
        type: 'text',
        text: '🎉 おかえりなさい！\n\nプレミアムプランご利用中です。\n無制限でGASコードを生成できます。\n\n「スプレッドシート操作」「Gmail自動化」など、作りたいコードのカテゴリを送信してください。'
      }])
    } else {
      // 無料ユーザーまたは期限切れユーザーには決済ボタン付きメッセージ
      const welcomeMessages = MessageTemplates.createWelcomeMessage()
      
      // LINE User IDをBase64エンコードしてStripeリンクに追加
      const encodedUserId = Buffer.from(userId).toString('base64')
      
      // Stripeリンクにclient_reference_idを追加
      const updatedMessages = welcomeMessages.map(msg => {
        if (msg.type === 'template' && 'template' in msg && msg.template.type === 'buttons') {
          msg.template.actions = msg.template.actions.map((action: any) => {
            if (action.type === 'uri' && action.uri.includes('stripe.com')) {
              // URLにclient_reference_idパラメータを追加
              action.uri += `?client_reference_id=${encodedUserId}`
            }
            return action
          })
        }
        return msg
      })
      
      await lineClient.pushMessage(userId, updatedMessages)
    }
    
  } catch (error) {
    logger.error('Failed to send welcome message', { 
      userId, 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
  }
}

/**
 * アンフォローイベント処理
 */
async function handleUnfollowEvent(event: any): Promise<void> {
  const userId = event.source?.userId
  if (!userId) return
  
  logger.info('User unfollowed', { userId })
  
  // セッションクリーンアップ
  sessionStore.delete(userId)
}

/**
 * 画像メッセージ処理
 */
async function processImageMessage(event: any, requestId: string): Promise<boolean> {
  const userId = event.source?.userId
  const messageId = event.message?.id
  const replyToken = event.replyToken
  
  if (!userId || !messageId || !replyToken) {
    logger.warn('Missing required fields for image', { userId, messageId })
    return false
  }

  logger.info('Processing image message', { userId, messageId, requestId })

  try {
    const result = await imageHandler.handleImageMessage(messageId, replyToken, userId)
    
    if (result.success && result.description) {
      // 画像の解析結果をコンテキストに保存
      let context = sessionStore.get(userId) || ConversationalFlow.resetConversation('spreadsheet')
      context.messages.push({
        role: 'user',
        content: `[画像アップロード] ${result.description}`
      })
      context.requirements.push(`画像の内容: ${result.description}`)
      sessionStore.set(userId, context)
    }
    
    return result.success
  } catch (error) {
    logger.error('Image processing error', { error })
    return false
  }
}

/**
 * ファイルメッセージ処理
 */
async function processFileMessage(event: any, requestId: string): Promise<boolean> {
  const userId = event.source?.userId
  const messageId = event.message?.id
  const fileName = event.message?.fileName
  const replyToken = event.replyToken
  
  if (!userId || !messageId || !replyToken) {
    logger.warn('Missing required fields for file', { userId, messageId })
    return false
  }

  logger.info('Processing file message', { userId, fileName, requestId })

  try {
    await imageHandler.handleFileMessage(messageId, fileName || 'unknown', replyToken)
    
    // ファイル情報をコンテキストに保存
    let context = sessionStore.get(userId) || ConversationalFlow.resetConversation('spreadsheet')
    context.messages.push({
      role: 'user',
      content: `[ファイルアップロード] ${fileName}`
    })
    sessionStore.set(userId, context)
    
    return true
  } catch (error) {
    logger.error('File processing error', { error })
    return false
  }
}

/**
 * ヘルスチェック用GET
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    service: 'GAS Generator Webhook',
    version: '2.0.0',
    mode: 'conversational',
    features: ['text', 'image', 'file'],
    timestamp: new Date().toISOString()
  })
}