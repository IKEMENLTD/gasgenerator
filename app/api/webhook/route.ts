import { NextRequest, NextResponse } from 'next/server'
import { LineApiClient } from '../../../lib/line/client'
import { MessageTemplates } from '../../../lib/line/message-templates'
import { QueueManager } from '../../../lib/queue/manager'
import { UserQueries } from '../../../lib/supabase/queries'
import { PremiumChecker } from '../../../lib/premium/premium-checker'
import { logger } from '../../../lib/utils/logger'
import { generateRequestId, generateSessionId, validateLineSignature } from '../../../lib/utils/crypto'
import { getCategoryIdByName } from '../../../lib/conversation/category-definitions'
import { ConversationalFlow, ConversationContext } from '../../../lib/conversation/conversational-flow'
import { CategoryDetector } from '../../../lib/conversation/category-detector'
import { SessionManager } from '../../../lib/conversation/session-manager'
import { LineImageHandler } from '../../../lib/line/image-handler'
import { rateLimiters } from '../../../lib/middleware/rate-limiter'
import { engineerSupport } from '../../../lib/line/engineer-support'
import { ClaudeApiClient } from '../../../lib/claude/client'

// Node.jsランタイムを使用（AI処理のため）
export const runtime = 'nodejs'
export const maxDuration = 30  // Webhookは30秒で応答

const lineClient = new LineApiClient()
const sessionManager = SessionManager.getInstance()
const imageHandler = new LineImageHandler()
const claudeClient = new ClaudeApiClient()

// プロセス終了時のクリーンアップ
if (typeof process !== 'undefined') {
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, cleaning up...')
    // SessionManagerが内部でクリーンアップを処理
  })
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, cleaning up...')
    // SessionManagerが内部でクリーンアップを処理
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
    // 即座にローディングアニメーションを開始（最大60秒）
    // これによりユーザーは処理中であることがすぐにわかる
    const loadingPromise = lineClient.showLoadingAnimation(userId, 60)

    // SessionManagerを使用してコンテキストを取得（キャッシュ優先、自動フォールバック）
    let context = await sessionManager.getContext(userId)

    // ローディング開始の結果を確認（非同期で実行）
    loadingPromise.then(success => {
      if (!success) {
        logger.warn('Loading animation failed to start', { userId })
      }
    })

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
      
      // スクショ待ちモードをセット（SessionManager経由）
      await sessionManager.saveContext(userId, {
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
        messageText === 'エンジニアへの相談' ||
        messageText === '👨‍💻 エンジニアに相談' ||
        messageText.includes('エンジニア') && messageText.includes('相談') ||
        messageText.includes('人間') && messageText.includes('相談')) {
      
      await engineerSupport.handleSupportRequest(userId, messageText, replyToken)
      return true
    }
    
    // 明らかなスパムの即時ブロック（連続する同じ文字、意味不明な文字列）
    const isSpam = (): boolean => {
      // 同じ文字が5回以上連続
      if (/(.)\1{4,}/.test(messageText)) return true

      // ランダムな文字列っぽい（数字と文字が混在して30文字以上）
      if (messageText.length > 30 && /^[a-zA-Z0-9]+$/.test(messageText)) return true

      // 絵文字だけで10個以上（ES5互換の正規表現）
      const emojiRegex = /[\uD83D][\uDC00-\uDE4F]|[\uD83D][\uDE80-\uDEFF]|[\u2600-\u26FF]|[\u2700-\u27BF]/g
      const emojiMatches = messageText.match(emojiRegex)
      if (emojiMatches && emojiMatches.length >= 10 && messageText.length < 50) return true

      // URLを5個以上含む
      const urlMatches = messageText.match(/https?:\/\/[^\s]+/g)
      if (urlMatches && urlMatches.length >= 5) return true

      return false
    }

    if (isSpam()) {
      logger.warn('Spam detected', { userId, messageText: messageText.substring(0, 100) })

      // スパムカウンターをインクリメント（メモリ内で管理）
      const spamCountKey = `spam_${userId}`
      const spamCount = (global as any)[spamCountKey] || 0
      ;(global as any)[spamCountKey] = spamCount + 1

      if (spamCount >= 3) {
        // 3回以上スパムを送信したユーザーは警告
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '⚠️ 不適切なメッセージが検出されました。\n\n続けると利用を制限させていただく場合があります。\n\n正しい使い方は「使い方」と送信してご確認ください。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
              { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
              { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }},
              { type: 'action', action: { type: 'message', label: '📖 使い方', text: '使い方' }},
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }}
            ]
          }
        }])

        // 5回以上はブロック対象として記録
        if (spamCount >= 5) {
          logger.error('User blocked for spam', { userId, count: spamCount })
          // TODO: Supabaseのusersテーブルにblocked_at列を追加して記録
        }
      }

      return true // スパムは処理終了
    }

    // 会話の最初のターンかどうかを判定
    const isFirstTurn = !context && !isResetCommand(messageText)

    // 最初のターンで、既知のコマンドではない場合はLLMで自然な返答
    if (isFirstTurn &&
        messageText.length >= 2 &&
        messageText.length <= 200 &&
        !getCategoryIdByName(messageText) &&
        !['メニュー', 'menu', '使い方', 'ヘルプ', '料金プラン'].includes(messageText.toLowerCase())) {

      try {
        // ローディングアニメーションを開始
        lineClient.showLoadingAnimation(userId, 10).catch(err => {
          logger.debug('Failed to show loading for LLM response', { err })
        })

        // システムプロンプトを含むメッセージを送信
        const messages = [
          {
            role: 'assistant' as const,
            content: `あなたはTaskMateというGASコード生成サービスのアシスタントです。
以下のルールに従って返答してください：

1. 挨拶には自然に挨拶を返す（時間帯に応じて）
2. サービスについての質問には簡潔に答える
3. TaskMateの強み：
   - 会話履歴を永続保存、いつでも続きから再開可能
   - 現役PMエンジニアへの直接相談が可能
   - LINE完結で使いやすい
4. コード生成の要望なら「どのようなコードを生成したいですか？」と確認
5. 返答は3行以内、敬語で丁寧に
6. 最後に適切なアクションを促す`
          },
          {
            role: 'user' as const,
            content: messageText
          }
        ]

        const finalResponse = await claudeClient.sendMessage(messages, userId, 1, 300)

        const responseText = finalResponse.content[0].text

        // 返答内容に基づいてクイックリプライを決定
        const quickReplyItems = []

        if (responseText.includes('コード') || responseText.includes('生成')) {
          quickReplyItems.push(
            { type: 'action', action: { type: 'message', label: 'コード生成を開始', text: 'コード生成を開始' }}
          )
        }

        quickReplyItems.push(
          { type: 'action', action: { type: 'message', label: '使い方', text: '使い方' }},
          { type: 'action', action: { type: 'message', label: '料金プラン', text: '料金プラン' }},
          { type: 'action', action: { type: 'message', label: 'メニュー', text: 'メニュー' }}
        )

        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: responseText,
          quickReply: quickReplyItems.length > 0 ? { items: quickReplyItems as any } : undefined
        }])

        logger.info('LLM first-turn response sent', {
          userId,
          messageLength: messageText.length,
          responseLength: responseText.length
        })

        return true

      } catch (error) {
        logger.warn('LLM response failed, falling back to default flow', { error })
        // LLMが失敗した場合は通常のフローに戻る
      }
    }

    // メニュー表示
    if (messageText === 'メニュー' || messageText === 'MENU' || messageText === 'menu' || messageText === 'Menu') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📋 メニュー',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🚀 コード生成開始', text: 'コード生成を開始' }},
            { type: 'action', action: { type: 'message', label: '💎 料金プラン', text: '料金プラン' }},
            { type: 'action', action: { type: 'message', label: '📖 使い方', text: '使い方' }},
            { type: 'action', action: { type: 'message', label: '📸 画像解析ガイド', text: '画像解析の使い方' }},
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談' }},
            { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }}
          ] as any
        }
      }])
      return true
    }

    // LLMサービスとの比較質問への対応
    // 正規化して検出（大文字小文字、ひらがな、カタカナ対応）
    const normalizedText = messageText.toLowerCase()

    // LLMサービス名の検出
    const hasLLMService =
      /chatgpt|gpt|claude|gemini|copilot|ai|llm/.test(normalizedText) ||
      normalizedText.includes('ちゃっとじーぴーてぃー') ||
      normalizedText.includes('じーぴーてぃー') ||
      normalizedText.includes('くろーど') ||
      normalizedText.includes('じぇみに') ||
      normalizedText.includes('こぱいろっと') ||
      normalizedText.includes('えーあい') ||
      normalizedText.includes('他のサービス') ||
      normalizedText.includes('ほかのサービス') ||
      normalizedText.includes('チャットジーピーティー') ||
      normalizedText.includes('ジーピーティー') ||
      normalizedText.includes('クロード') ||
      normalizedText.includes('ジェミニ') ||
      normalizedText.includes('コパイロット') ||
      normalizedText.includes('エーアイ')

    // 比較を意図する文脈の検出
    const hasComparisonIntent =
      /違い|差|比較|どう|価値|merit|benefit|difference|compare|vs|versus/.test(normalizedText) ||
      normalizedText.includes('ちがい') ||
      normalizedText.includes('さ') ||
      normalizedText.includes('ひかく') ||
      normalizedText.includes('かち') ||
      normalizedText.includes('めりっと') ||
      normalizedText.includes('べねふぃっと') ||
      normalizedText.includes('なぜ') ||
      normalizedText.includes('なに') ||
      normalizedText.includes('何') ||
      normalizedText.includes('どっち') ||
      normalizedText.includes('どちら') ||
      normalizedText.includes('いい') ||
      normalizedText.includes('よい') ||
      normalizedText.includes('良い') ||
      normalizedText.includes('チガイ') ||
      normalizedText.includes('サ') ||
      normalizedText.includes('ヒカク') ||
      normalizedText.includes('カチ') ||
      normalizedText.includes('メリット') ||
      normalizedText.includes('ベネフィット')

    // TaskMate自体への言及を除外（自己言及は比較対象外）
    const isSelfReference =
      normalizedText.includes('taskmate') ||
      normalizedText.includes('タスクメイト') ||
      normalizedText.includes('たすくめいと')

    if (hasLLMService && hasComparisonIntent && !isSelfReference) {

      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: 'TaskMateと他のLLMサービスの本質的な違い\n\n【TaskMateにしかない強み】\n\n1. 無制限の会話履歴と文脈保持\nTaskMateは全ての会話履歴を永続的に保存。1ヶ月前の続きから再開可能。他のLLMは会話が長くなると文脈を失い、最初から説明し直す必要があります。\n\n2. 現役PMエンジニアへの直接相談\n「エンジニアに相談」ボタンで、10年以上の実務経験を持つフルスタックエンジニアが直接対応。複雑な要件も一緒に設計から考えます。他のLLMではAIのみの対応です。\n\n3. 修正履歴の完全管理\n過去に生成した全てのコードを記憶し、修正要望も文脈を保持したまま対応。「先週作ったコードの〇〇を修正」といった依頼も可能。\n\n4. LINE完結の業務フロー\nスクショ送信→コード生成→動作確認→修正依頼まで全てLINE内で完結。ブラウザを開く必要なし。\n\n5. 実装サポートまで含む\n生成したコードの実装方法、エラー対処、カスタマイズまで一貫してサポート。孤独な試行錯誤は不要です。\n\n【使い分けの目安】\n・他のLLM：調査や学習向き\n・TaskMate：実務で今すぐ使えるコードと実装サポートが必要な方向き',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '無料で試す', text: 'コード生成を開始' }},
            { type: 'action', action: { type: 'message', label: 'エンジニアに相談', text: 'エンジニアに相談' }},
            { type: 'action', action: { type: 'message', label: '料金プラン', text: '料金プラン' }}
          ] as any
        }
      }])
      return true
    }

    // 使い方ガイド
    if (messageText === '使い方を教えて' || messageText === '使い方' || messageText === 'ヘルプ') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📖 Task mate 使い方ガイド\n\n【基本の使い方】\n1️⃣ 「コード生成を開始」を送信\n2️⃣ カテゴリを選択（スプレッドシート等）\n3️⃣ 詳しい要望を入力\n4️⃣ 数分でコードが生成されます\n\n【便利な機能】\n🔄 修正したい：生成後に修正可能\n📷 エラースクショ：エラー画面を送信で解決策提示\n📸 画像解析：Excel/PDFのスクショからコード生成\n\n【料金プラン】\n🆓 無料：月10回\n💎 プレミアム：月額10,000円\n🎆 プロフェッショナル：月額50,000円\n\n💡 コツ：具体的に要望を伝えるほど、良いコードが生成されます！',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
            { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
            { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
            { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
            { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }},
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' }},
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }}
          ]
        }
      }])
      return true
    }
    
    if (messageText === '画像解析の使い方') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📸 画像解析の使い方\n\n1️⃣ エラー画面のスクショを送る\n→ エラーの原因と解決コードを生成\n\n2️⃣ ExcelやPDFのスクショを送る\n→ データ構造を理解してコード生成\n\n3️⃣ Webサイトのスクショを送る\n→ スクレイピングやAPI連携コード生成\n\n💡 コツ：画像は鮮明に、文字が読めるように撮影してください',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
            { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
            { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
            { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
            { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }},
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' }},
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }}
          ]
        }
      }])
      return true
    }
    
    if (messageText === 'プレミアムプラン' || messageText === '料金プラン' || messageText === 'アップグレード') {
      // 現在のプレミアムステータスを確認
      const currentStatus = await PremiumChecker.checkPremiumStatus(userId)

      await lineClient.replyMessage(replyToken, [
        {
          type: 'template',
          altText: '料金プランのご案内',
          template: {
            type: 'carousel',
            columns: [
              {
                title: '🆓 無料プラン',
                text: '現在のプラン\n\n✅ 月10回まで生成\n✅ 全機能利用可能\n✅ 画像解析対応\n\n月額 0円',
                actions: [{
                  type: 'message',
                  label: currentStatus.isPremium || currentStatus.isProfessional ? 'ダウングレード' : '現在のプラン',
                  text: currentStatus.isPremium || currentStatus.isProfessional ? 'プランをダウングレードしたい' : '無料プランを継続'
                }]
              },
              {
                title: '💎 プレミアムプラン',
                text: '人気No.1\n\n✅ 無制限生成\n✅ 優先サポート\n✅ 履歴無制限保存\n\n月額 10,000円',
                actions: [{
                  type: 'uri',
                  label: currentStatus.isPremium ? '現在のプラン' : '申し込む',
                  uri: currentStatus.isPremium
                    ? 'https://line.me/R/ti/p/@YOUR_LINE_ID'  // 管理画面へのリンク
                    : `https://gasgenerator.onrender.com/terms?plan=premium&user_id=${userId}`
                }]
              },
              {
                title: '🎆 プロフェッショナル',
                text: '法人向け\n\n✅ 全機能無制限\n✅ 24時間以内対応\n✅ 専任エンジニア\n✅ APIアクセス\n\n月額 50,000円',
                actions: [{
                  type: 'uri',
                  label: currentStatus.isProfessional ? '現在のプラン' : '申し込む',
                  uri: currentStatus.isProfessional
                    ? 'https://line.me/R/ti/p/@YOUR_LINE_ID'  // 管理画面へのリンク
                    : `https://gasgenerator.onrender.com/terms?plan=professional&user_id=${userId}`
                }]
              }
            ]
          }
        },
        {
          type: 'text',
          text: '下のボタンから操作を選んでください',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
              { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
              { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }},
              { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' }},
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }}
            ]
          }
        }
      ] as any)
      return true
    }

    // プランのダウングレード処理
    if (messageText === 'プランをダウングレードしたい') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📝 プランのダウングレードについて\n\n現在の有料プランを解約する場合は、以下の手順でお手続きください：\n\n1️⃣ Stripeカスタマーポータルから解約\n2️⃣ 次回更新日に自動的に無料プランへ移行\n3️⃣ それまでは有料プラン機能を利用可能\n\n⚠️ 解約しても当月分の返金はありません',
        quickReply: {
          items: [
            {
              type: 'action',
              action: {
                type: 'uri',
                label: '解約手続きへ',
                uri: 'https://billing.stripe.com/p/login/aEU3cb2So0v78ICbSz6oo09'
              }
            },
            { type: 'action', action: { type: 'message', label: '👨‍💻 サポートに相談', text: 'エンジニアに相談' }},
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }}
          ] as any
        }
      }] as any)
      return true
    }

    // コード生成後の修正モード（最優先でチェック）
    if (messageText === '修正' || messageText === '修正したい' || messageText === 'やり直し') {
      // SessionManagerから最新のセッションを再取得
      if (!context) {
        context = await sessionManager.getContext(userId)
      }

      // デバッグログ追加
      logger.info('Modify button pressed', {
        userId,
        hasContext: !!context,
        lastGeneratedCode: context?.lastGeneratedCode,
        contextKeys: context ? Object.keys(context) : []
      })

      // コンテキストがある場合のみ修正モードに入る
      if (context) {
        context.isModifying = true
        context.lastGeneratedCode = false

        // SessionManager経由で保存
        await sessionManager.saveContext(userId, context)

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
      } else {
        // コンテキストがない場合は通常のメッセージとして処理させる
        logger.info('No context for modification, treating as new message', { userId })
      }
    }
    
    // プレミアムアクティベーションコードのチェック（64文字以上）
    if (messageText.length >= 64) {
      // プレミアムハンドラーをインポートして実行
      const { checkAndActivatePremium } = await import('../../../lib/premium-handler')
      const result = await checkAndActivatePremium(userId, messageText)

      if (result.success) {
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: `🎉 プレミアムプラン アクティベーション成功！\n\n✨ プレミアム機能が有効になりました\n\n【特典】\n・無制限のGASコード生成\n・優先サポート\n・高度な機能へのアクセス\n\n有効期限: ${result.expiresAt}\n\nプレミアムプランをお楽しみください！`
        }] as any)
        return true
      }
      // アクティベーション失敗は無視して通常処理を続行
      logger.info('Invalid activation code attempt', { userId, codeLength: messageText.length })
    }

    // 続きから再開コマンド
    if (isContinueCommand(messageText)) {
      // 既にコンテキストがある場合はそれを使用
      if (context) {
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: `📚 会話を続けます。\n\n現在のカテゴリ：${context.category || '未設定'}\n\n続きをどうぞ！`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }},
              { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' }}
            ]
          }
        }] as any)
        return true
      }

      // 過去のメッセージを取得
      const recentMessages = await sessionManager.getRecentMessages(userId, 10)
      if (recentMessages.length > 0) {
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: `📚 前回の会話から続きを再開します。\n\n前回の内容：\n${recentMessages[recentMessages.length - 1].content.substring(0, 100)}...\n\n続きをどうぞ！`,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }},
              { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' }}
            ]
          }
        }] as any)

        // Supabaseから最新のセッションを取得
        context = await sessionManager.recoverSession(userId)
        if (context) {
          // コンテキストを復活させたのでセッションを継続
          return await continueConversation(userId, context, '', replyToken)
        }
        return true
      } else {
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '過去の会話履歴が見つかりません。新しく始めましょう！',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }}
            ]
          }
        }] as any)
        return true
      }
    }

    // リセットコマンド（完全にクリア）
    if (isResetCommand(messageText)) {
      await sessionManager.deleteSession(userId)
      context = null
      logger.info('Session reset requested', { userId })
    }

    // 新規会話開始
    if (!context) {
      // カテゴリを選択した場合は新規作成として履歴をクリア
      const isSelectingCategory = getCategoryIdByName(messageText) !== null
      const clearHistory = isResetCommand(messageText) || isSelectingCategory
      logger.info('Starting new conversation', { userId, clearHistory, isSelectingCategory })
      return await startNewConversation(userId, messageText, replyToken, clearHistory)
    }

    // 既存会話の継続
    // メッセージをSessionManager経由で保存
    await sessionManager.saveMessage(
      userId,
      context.sessionId || generateSessionId(),
      'user',
      messageText,
      { timestamp: Date.now() }
    )
    
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
  const resetCommands = ['リセット', '最初から', '新しいコードを作りたい', 'reset', 'restart', '新規作成']
  return resetCommands.some(cmd => text.toLowerCase().includes(cmd))
}

/**
 * 続きから再開コマンドかどうか判定
 */
function isContinueCommand(text: string): boolean {
  const continueCommands = ['続きから', '続き', '再開', 'continue', 'resume', '昨日の続き', '前回の続き']
  return continueCommands.some(cmd => text.toLowerCase().includes(cmd))
}

/**
 * 新規会話開始
 */
async function startNewConversation(
  userId: string,
  messageText: string,
  replyToken: string,
  clearHistory: boolean = true
): Promise<boolean> {
  // カテゴリ判定
  let categoryId = getCategoryIdByName(messageText)
  let autoDetected = false

  if (!categoryId) {
    // メッセージ内容から自動的にカテゴリを推測
    categoryId = await CategoryDetector.detectFromMessage(messageText, userId)
    if (categoryId) {
      autoDetected = true
      logger.info('Category auto-detected', { userId, categoryId, messageText })
    }

    if (!categoryId) {
      // それでも判定できない場合のみカテゴリ選択画面を表示
      // 過去の履歴があるかチェック
      const hasHistory = (await sessionManager.getRecentMessages(userId, 1)).length > 0

      const quickReplyItems = [
        { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
        { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
        { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
        { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
        { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }}
      ]

      // 履歴がある場合は「続きから」ボタンを追加
      if (hasHistory) {
        quickReplyItems.unshift({
          type: 'action',
          action: { type: 'message', label: '📚 続きから', text: '続きから' }
        })
      }

      quickReplyItems.push({
        type: 'action',
        action: { type: 'message', label: '👨‍💻 エンジニアに相談', text: 'エンジニアに相談' }
      })

      // メニューボタンを最後に追加
      quickReplyItems.push({
        type: 'action',
        action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }
      })

      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: hasHistory
          ? '👋 お帰りなさい！\n\n前回の続きから再開するか、新しくコードを作成できます：'
          : '👋 こんにちは！GASコードを自動生成します。\n\n作りたいコードのカテゴリを選んでください：',
        quickReply: {
          items: quickReplyItems as any
        }
      }])
      return true
    }
  }

  // SessionManager経由で新しいセッションを作成
  const context = await sessionManager.createSession(userId, categoryId, messageText, clearHistory)

  // 自動検出の場合は、メッセージを要件として扱う
  if (autoDetected) {
    context.messages.push({
      role: 'user',
      content: messageText
    })
  }
  
  // 最初の質問を送信
  const result = await ConversationalFlow.processConversation(context, messageText)
  
  // 更新されたコンテキストをSessionManager経由で保存
  await sessionManager.saveContext(userId, result.updatedContext)
  
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
    // セッションのみクリア（メッセージ履歴は保持）
    const memoryStore = (sessionManager as any).memoryStore
    if (memoryStore) {
      memoryStore.delete(userId)
    }
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '❌ キャンセルしました。\n\n新しくコードを生成したい場合は、カテゴリを選んでください：',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' }},
          { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' }},
          { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' }},
          { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' }},
          { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' }},
          { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアに相談', text: 'エンジニアに相談' }},
          { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' }}
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
      
      // SessionManager経由で更新を保存
      await sessionManager.saveContext(userId, context)
      return true
    }
    // 「追加で説明します」ボタン
    else if (messageText === '追加で説明します') {
      // 追加説明モードに切り替え
      context.isAddingDescription = true
      
      // SessionManager経由で更新
      await sessionManager.saveContext(userId, context)
      
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
    
    // SessionManager経由で更新
    await sessionManager.saveContext(userId, context)
    
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
      
      // SessionManager経由で更新を保存
      await sessionManager.saveContext(userId, context)
      return true
    } else if (messageText === '修正' || messageText === 'やり直し' || messageText === '修正したい') {
      // 要件の修正
      context.readyForCode = false
      context.isModifying = true  // 修正モードフラグ
      await sessionManager.saveContext(userId, context)
      
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
    
    // SessionManager経由で更新
    await sessionManager.saveContext(userId, context)
    
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
    
    // SessionManager経由で更新
    await sessionManager.saveContext(userId, result.updatedContext)
    
    // アシスタントの応答も保存
    if (result.reply) {
      await sessionManager.saveMessage(
        userId,
        context.sessionId || generateSessionId(),
        'assistant',
        result.reply
      )
    }

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
      // 制限に達した場合 - カルーセルで両プランを表示
      // 利用規約ページ経由でStripeに誘導
      const termsUrlPremium = `https://gasgenerator.onrender.com/terms?plan=premium&user_id=${userId}`
      const termsUrlProfessional = `https://gasgenerator.onrender.com/terms?plan=professional&user_id=${userId}`

      await lineClient.replyMessage(replyToken, [{
        type: 'template',
        altText: '利用制限に達しました - プランをアップグレード',
        template: {
          type: 'carousel',
          columns: [
            {
              title: '💎 プレミアムプラン',
              text: '月額10,000円\n\n✅ 無制限生成\n✅ 全カテゴリ利用可能\n✅ エラー解決サポート',
              actions: [{
                type: 'uri',
                label: 'プレミアムプランを購入',
                uri: termsUrlPremium
              }]
            },
            {
              title: '🎆 プロフェッショナル',
              text: '月額50,000円\n\n✅ 無制限生成\n✅ 優先サポート\n✅ エンジニア直接対応\n✅ 複雑な要件対応',
              actions: [{
                type: 'uri',
                label: 'プロフェッショナルを購入',
                uri: termsUrlProfessional
              }]
            }
          ]
        }
      }] as any)
      return
    }
    
    // 使用回数を記録
    await PremiumChecker.incrementUsage(userId)
    
    // ローディングアニメーションを開始（30秒）
    const loadingStarted = await lineClient.showLoadingAnimation(userId, 30)
    if (!loadingStarted) {
      logger.warn('Loading animation failed to start', { userId })
    }
    
    // セッションIDを確保
    const sessionId = context.sessionId || generateSessionId()
    
    // キューに追加（セッションIDを含める）
    const job = await QueueManager.addJob({
      userId: userId,  // LINE User IDを使用（外部キー制約を回避）
      lineUserId: userId,  // LINE User IDも保存
      sessionId: sessionId,
      category: context.category,
      subcategory: 'conversational',
      requirements: {
        category: context.category,
        subcategory: 'conversational',
        details: ConversationalFlow.generateCodePrompt(context),
        prompt: ConversationalFlow.generateCodePrompt(context),  // プロンプトとして保存
        conversation: true  // 会話型フラグ
      } as any
    })
    
    // チェックポイントを作成（バックグラウンド）
    sessionManager.createCheckpoint(userId)
    
    // 【重要】即座に処理を開始（キューを待たない）
    setTimeout(async () => {
      try {
        const { QueueProcessor } = await import('../../../lib/queue/processor')
        const processor = new QueueProcessor()
        await processor.processJob(job)
        logger.info('Job processed immediately', { jobId: job.id, userId })
      } catch (error) {
        logger.error('Immediate job processing failed', { error, jobId: job.id })
      }
    }, 2000) // 2秒後に処理開始

    // 確認メッセージを送信
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '🚀 コード生成を開始しました！\n\n⏰ 2-3分で完成します\n完了したら自動通知でお知らせします'
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
  await sessionManager.deleteSession(userId)
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
    // 画像処理にも即座にローディングアニメーションを開始
    lineClient.showLoadingAnimation(userId, 60).catch(err => {
      logger.warn('Failed to show loading for image', { err })
    })

    // SessionManagerから完全なコンテキストを取得
    let context = await sessionManager.getContext(userId)
    
    const isWaitingForScreenshot = context && (context as any).waitingForScreenshot
    
    if (isWaitingForScreenshot && context) {
      logger.info('Processing screenshot in waiting mode', { userId })
      // waitingForScreenshotフラグをクリア
      delete (context as any).waitingForScreenshot
      
      // SessionManager経由で更新を保存
      await sessionManager.saveContext(userId, context)
    }
    
    const result = await imageHandler.handleImageMessage(messageId, replyToken, userId)
    
    if (result.success && result.description) {
      // コンテキストがない場合は新規作成
      if (!context) {
        context = await sessionManager.createSession(userId, 'spreadsheet', `[画像アップロード] ${result.description}`)
      }
      
      // メッセージ内容を決定
      const messageContent = isWaitingForScreenshot
        ? `[エラースクリーンショット] ${result.description}\nこのエラーを解決するコードを生成してください。`
        : `[画像アップロード] ${result.description}`
      
      // SessionManager経由でメッセージを保存
      await sessionManager.saveMessage(
        userId,
        context.sessionId || generateSessionId(),
        'user',
        messageContent,
        { type: 'image', messageId, analysisResult: result.description }
      )
      
      // コンテキストを更新
      context.messages.push({
        role: 'user',
        content: messageContent
      })
      
      if (isWaitingForScreenshot) {
        context.requirements.errorScreenshot = result.description
        context.requirements.isErrorFix = 'true'
      } else {
        context.requirements.imageContent = result.description
      }
      
      context.requirements.hasScreenshot = 'true'
      
      // SessionManager経由で更新を保存
      await sessionManager.saveContext(userId, context)
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
    
    // SessionManagerから完全なコンテキストを取得
    let context = await sessionManager.getContext(userId)
    if (!context) {
      // 新規セッション作成
      context = await sessionManager.createSession(
        userId, 
        'spreadsheet', 
        `[ファイルアップロード] ${fileName}`
      )
    }
    
    // SessionManager経由でメッセージを保存
    await sessionManager.saveMessage(
      userId,
      context.sessionId || generateSessionId(),
      'user',
      `[ファイルアップロード] ${fileName}`,
      { type: 'file', messageId, fileName }
    )
    
    // コンテキストを更新
    context.messages.push({
      role: 'user',
      content: `[ファイルアップロード] ${fileName}`
    })
    
    // SessionManager経由で更新
    await sessionManager.saveContext(userId, context)
    
    return true
  } catch (error) {
    logger.error('File processing error', { 
      userId,
      fileName,
      error: error instanceof Error ? error.message : String(error)
    })
    return false
  }
}

/**
 * ヘルスチェック用GET
 */
export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    service: 'Task mate Webhook',
    version: '2.0.0',
    mode: 'conversational',
    features: ['text', 'image', 'file'],
    timestamp: new Date().toISOString()
  })
}