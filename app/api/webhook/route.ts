import { NextRequest, NextResponse } from 'next/server'
import { LineApiClient } from '../../../lib/line/client'
import { MessageTemplates } from '../../../lib/line/message-templates'
import { QueueManager } from '../../../lib/queue/manager'
import { UserQueries } from '../../../lib/supabase/queries'
import { PremiumChecker } from '../../../lib/premium/premium-checker'
import { logger } from '../../../lib/utils/logger'
import { generateRequestId, generateUUID, validateLineSignature } from '../../../lib/utils/crypto'
import { getCategoryIdByName } from '../../../lib/conversation/category-definitions'
import { ConversationalFlow, ConversationContext } from '../../../lib/conversation/conversational-flow'
import { ConversationSessionStore } from '../../../lib/conversation/session-store'
import { LineImageHandler } from '../../../lib/line/image-handler'
import { rateLimiters } from '../../../lib/middleware/rate-limiter'
import { engineerSupport } from '../../../lib/line/engineer-support'

// Node.jsランタイムを使用（AI処理のため）
export const runtime = 'nodejs'
export const maxDuration = 30  // Webhookは30秒で応答

const lineClient = new LineApiClient()
const sessionStore = ConversationSessionStore.getInstance()
const imageHandler = new LineImageHandler()

// プロセス終了時のクリーンアップ
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, cleaning up...')
    sessionStore.destroy()
  })
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, cleaning up...')
    sessionStore.destroy()
  })
}

// 重複イベント検出用のメモリキャッシュ（メモリリーク対策付き）
const recentEventKeys = new Map<string, number>()
const MAX_CACHE_SIZE = 20 // メモリ節約のため20に制限
const CACHE_TTL = 10000 // 10秒に短縮

// キャッシュクリーンアップはisDuplicateEvent内で実行

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
      // 署名がない場合は401を返す（セキュリティ上重要）
      return NextResponse.json({ error: 'No signature' }, { status: 401 })
    }

    // 2. セキュリティ検証
    // LINE署名検証（validateLineSignature関数を使用）
    const isValidSignature = await validateLineSignature(body, signature)
    if (!isValidSignature) {
      logger.warn('Invalid LINE signature', { requestId })
      // 署名検証失敗は401を返す（セキュリティ上重要）
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }
    
    // リクエスト元検証は署名検証で十分なのでスキップ
    // LINEはOriginヘッダーを送らないし、IPも変動する
    logger.info('LINE signature validated, skipping origin/IP check', { requestId })

    // 3. ボディをパース
    let parsedBody: any
    try {
      parsedBody = JSON.parse(body)
    } catch (e) {
      logger.error('Invalid JSON body', { requestId })
      // LINEの再送を防ぐため200を返す（LINE仕様）
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
 * テキストメッセージ処理
 */
async function processTextMessage(event: any, requestId: string): Promise<boolean> {
  const userId = event.source?.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken
  
  // デバッグ情報をログに記録
  logger.debug('Event source info', {
    sourceType: event.source?.type,
    userId: event.source?.userId,
    groupId: event.source?.groupId,
    roomId: event.source?.roomId,
    message: messageText?.substring(0, 100) // メッセージは最初の100文字のみ
  })
  
  // グループIDを含むメッセージを返信（グループ内でのみ）
  if (event.source?.type === 'group' && messageText === 'グループID確認') {
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `📍 グループID: ${event.source.groupId}\n\nこのIDを環境変数 ENGINEER_SUPPORT_GROUP_ID に設定してください。`
    }])
    return true
  }
  
  // ユーザーIDを返信（個人チャットでのみ）
  if (event.source?.type === 'user' && messageText === 'ユーザーID確認') {
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `👤 あなたのユーザーID: ${event.source.userId}\n\nエンジニアの場合は、このIDを環境変数 ENGINEER_USER_IDS に追加してください。`
    }])
    return true
  }
  // 🔍 デバッグコード追加（ここまで）
  
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

    // エラースクリーンショット待ち受けモード
    if (messageText === 'エラーのスクリーンショットを送る' || 
        messageText.includes('エラー') && messageText.includes('スクショ') ||
        messageText === '📷 エラースクリーンショット') {
      
      // 既存のコンテキストを維持
      const existingContext = context || {
        messages: [],
        category: null,
        subcategory: null,
        extractedRequirements: {},
        currentStep: 1,
        readyForCode: false
      }
      
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📸 エラーのスクリーンショットを送信してください。\n\n画像を確認後、エラーの原因と解決方法をお伝えします。\n\n※画像を送信するか、「キャンセル」と入力してください。'
      }])
      
      // スクショ待ちモードをセット（既存コンテキストを保持）
      sessionStore.set(userId, {
        ...existingContext,
        waitingForScreenshot: true,
        lastGeneratedCode: ('lastGeneratedCode' in existingContext ? existingContext.lastGeneratedCode : null)
      } as any)
      
      return true
    }
    
    // 画像解析関連のボタンハンドラ
    if (messageText === '画像を解析') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📸 解析したい画像を送信してください。\n\nスクリーンショット、エラー画面、Excel・PDFのスクショなど、どんな画像でも解析します。'
      }])
      return true
    }
    
    // エンジニアに相談
    if (messageText === 'エンジニアに相談する' || 
        messageText === 'エンジニアに相談' || 
        messageText === '👨‍💻 エンジニアに相談' ||
        messageText.includes('人間') && messageText.includes('相談')) {
      
      await engineerSupport.handleSupportRequest(userId, messageText, replyToken)
      return true
    }
    
    // 使い方ガイド
    if (messageText === '使い方を教えて' || messageText === '使い方' || messageText === 'ヘルプ') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📖 GAS Generator 使い方ガイド\n\n【基本の使い方】\n1️⃣ 「コード生成を開始」を送信\n2️⃣ カテゴリを選択（スプレッドシート等）\n3️⃣ 詳しい要望を入力\n4️⃣ 数分でコードが生成されます\n\n【便利な機能】\n🔄 修正したい：生成後に修正可能\n📷 エラースクショ：エラー画面を送信で解決策提示\n📸 画像解析：Excel/PDFのスクショからコード生成\n\n【プレミアムプラン】\n💎 月額10,000円で無制限利用\n🆓 無料プラン：月10回まで\n\n💡 コツ：具体的に要望を伝えるほど、良いコードが生成されます！'
      }])
      return true
    }
    
    if (messageText === '画像解析の使い方') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📸 画像解析の使い方\n\n1️⃣ エラー画面のスクショを送る\n→ エラーの原因と解決コードを生成\n\n2️⃣ ExcelやPDFのスクショを送る\n→ データ構造を理解してコード生成\n\n3️⃣ Webサイトのスクショを送る\n→ スクレイピングやAPI連携コード生成\n\n💡 コツ：画像は鮮明に、文字が読めるように撮影してください'
      }])
      return true
    }
    
    if (messageText === 'プレミアムプラン') {
      const encodedUserId = Buffer.from(userId).toString('base64')
      await lineClient.replyMessage(replyToken, [{
        type: 'template',
        altText: 'プレミアムプランのご案内',
        template: {
          type: 'buttons',
          text: '💎 プレミアムプラン\n\n✅ 無制限のコード生成\n✅ 画像解析無制限\n✅ 優先サポート\n\n月額 500円',
          actions: [{
            type: 'uri',
            label: '今すぐ申し込む',
            uri: `https://buy.stripe.com/8wMdTAc9m8zQgmI9AA?client_reference_id=${encodedUserId}`
          }]
        }
      }] as any)
      return true
    }

    // コード生成後の修正モード（最優先でチェック）
    if (messageText === '修正' || messageText === '修正したい' || messageText === 'やり直し') {
      // Supabaseから最新のセッションを取得（別プロセスで保存された可能性があるため）
      if (!context) {
        context = await sessionStore.getAsync(userId)
      }
      
      // デバッグログ追加
      logger.info('Modify button pressed', {
        userId,
        hasContext: !!context,
        lastGeneratedCode: context?.lastGeneratedCode,
        contextKeys: context ? Object.keys(context) : []
      })
      
      // セッションがない場合は新規作成して修正モードに
      if (!context) {
        context = {
          messages: [],
          category: null,
          subcategory: null,
          requirements: {},
          extractedRequirements: {},
          currentStep: 1,
          readyForCode: false,
          lastGeneratedCode: true,  // 修正モードとして扱う
          isModifying: true
        } as any
      }
      
      // lastGeneratedCodeがない場合でも修正モードに入る
      if (context && (context.lastGeneratedCode || messageText === '修正したい')) {
        context.isModifying = true
        context.lastGeneratedCode = false
        sessionStore.set(userId, context)
        
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '🔧 修正したい内容を教えてください。\n\n例：\n・「エラー処理を追加して」\n・「ログを詳細に出力」\n・「シート名を変更」',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }},
              { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' }}
            ]
          }
        }] as any)
        return true
      }
    }
    
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
    
    // エラー時はコンテキストを保持（データ損失防止）
    // sessionStore.delete(userId) // コメントアウト：セッションを保持
    logger.info('Preserving session after error', { userId })
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
  
  // TTL後に自動削除（シンプルなsetTimeoutを使用）
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
  // キャンセル処理（どの段階でも有効）
  if (messageText === 'キャンセル') {
    sessionStore.delete(userId)
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '❌ キャンセルしました。\n\n新しくコードを生成したい場合は、カテゴリを選んでください：',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
          { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
          { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
          { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
          { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }}
        ]
      }
    }] as any)
    return true
  }

  // 画像解析後の処理
  if (context.requirements?.imageContent) {
    // 「はい、この内容で生成」ボタン
    if (messageText === 'はい、この内容で生成') {
      // 画像内容を元にコード生成開始
      context.readyForCode = true
      await startCodeGeneration(userId, context, replyToken)
      // セッションを削除せず、コード生成後モードに変更
      context.lastGeneratedCode = true
      context.readyForCode = false
      sessionStore.set(userId, context)
      return true
    }
    // 「追加で説明します」ボタン
    else if (messageText === '追加で説明します') {
      // 追加説明モードに切り替え
      context.isAddingDescription = true
      sessionStore.set(userId, context)
      
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📝 追加で説明したい内容を入力してください。\n\n例：\n・「A列の日付を自動で入力したい」\n・「重複データは削除してほしい」\n・「エラー時はログを出力して」',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' }}
          ]
        }
      }] as any)
      return true
    }
  }

  // 追加説明モードの処理
  if ((context as any).isAddingDescription) {
    // 追加説明を要件に追加
    if (!context.requirements) {
      context.requirements = {}
    }
    context.requirements.additionalDescription = messageText
    context.readyForCode = true
    ;(context as any).isAddingDescription = false
    sessionStore.set(userId, context)
    
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `✅ 追加説明を受け付けました。\n\n【画像の内容】\n${context.requirements.imageContent}\n\n【追加説明】\n${messageText}\n\nこの内容でコードを生成します。よろしいですか？`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい' }},
          { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' }},
          { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' }}
        ]
      }
    }] as any)
    return true
  }

  // コード生成確認段階
  if (context.readyForCode) {
    if (messageText === 'はい' || messageText.includes('生成') || messageText === 'OK') {
      // コード生成開始
      await startCodeGeneration(userId, context, replyToken)
      // セッションを削除せず、コード生成後モードに変更
      context.lastGeneratedCode = true
      context.readyForCode = false
      sessionStore.set(userId, context)
      return true
    } else if (messageText === '修正' || messageText === 'やり直し' || messageText === '修正したい') {
      // 要件の修正
      context.readyForCode = false
      context.isModifying = true  // 修正モードフラグ
      sessionStore.set(userId, context)
      
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '修正したい内容を教えてください。\n\n例：\n・「もっと詳細なログを出力したい」\n・「エラー処理を追加して」\n・「シート名を変更したい」\n\n修正内容を入力してください：',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }},
            { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' }}
          ]
        }
      }] as any)
      return true
    }
  }

  // 修正モードの処理
  if ((context as any).isModifying) {
    // 修正内容を要件に追加
    if (!context.requirements) {
      context.requirements = {}
    }
    (context.requirements as any).modifications = messageText
    context.readyForCode = true
    ;(context as any).isModifying = false
    sessionStore.set(userId, context)
    
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `修正内容を確認しました：\n\n「${messageText}」\n\nこの修正を反映してコードを再生成します。よろしいですか？`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい' }},
          { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' }},
          { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' }}
        ]
      }
    }] as any)
    return true
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
    // プレミアムステータスチェック
    const premiumStatus = await PremiumChecker.checkPremiumStatus(userId)
    
    if (!premiumStatus.canGenerate) {
      // 制限に達した場合
      const upgradeUrl = PremiumChecker.getUpgradeUrl(userId)
      await lineClient.replyMessage(replyToken, [{
        type: 'template',
        altText: premiumStatus.message || '利用制限に達しました',
        template: {
          type: 'buttons',
          text: premiumStatus.message || '📊 無料プランの月間利用回数（10回）に達しました。\n\nプレミアムプランで無制限利用が可能です！',
          actions: [{
            type: 'uri',
            label: '💎 プレミアムプランを見る',
            uri: upgradeUrl
          }]
        }
      }] as any)
      return
    }
    
    // 使用回数を記録
    await PremiumChecker.incrementUsage(userId)
    
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
        category: context.category,
        subcategory: 'conversational',
        details: ConversationalFlow.generateCodePrompt(context)
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
    const isPremium = (user as any)?.subscription_status === 'premium' && 
                     (user as any)?.subscription_end_date && 
                     new Date((user as any).subscription_end_date) > new Date()
    
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
    // スクリーンショット待機モードのチェック
    let context = sessionStore.get(userId)
    const isWaitingForScreenshot = context && (context as any).waitingForScreenshot
    
    if (isWaitingForScreenshot && context) {
      logger.info('Processing screenshot in waiting mode', { userId })
      // waitingForScreenshotフラグをクリア
      delete (context as any).waitingForScreenshot
      sessionStore.set(userId, context)
    }
    
    const result = await imageHandler.handleImageMessage(messageId, replyToken, userId)
    
    if (result.success && result.description) {
      // 画像の解析結果をコンテキストに保存
      context = sessionStore.get(userId) || ConversationalFlow.resetConversation('spreadsheet')
      
      // スクリーンショット待機モードだった場合は、エラー解決のコンテキストとして保存
      if (isWaitingForScreenshot) {
        context.messages.push({
          role: 'user',
          content: `[エラースクリーンショット] ${result.description}\nこのエラーを解決するコードを生成してください。`
        })
        context.requirements.errorScreenshot = result.description
        context.requirements.isErrorFix = 'true'
      } else {
        context.messages.push({
          role: 'user',
          content: `[画像アップロード] ${result.description}`
        })
        context.requirements.imageContent = result.description
      }
      
      context.requirements.hasScreenshot = 'true'
      sessionStore.set(userId, context)
    }
    
    return result.success
  } catch (error) {
    logger.error('Image processing error', { 
      userId,
      messageId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
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
    await imageHandler.handleFileMessage(messageId, fileName || 'unknown', replyToken, userId)
    
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