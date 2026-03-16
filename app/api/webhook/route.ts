import { NextRequest, NextResponse } from 'next/server'
import { LineApiClient } from '../../../lib/line/client'
import { MessageTemplates, createWaitingTimeCarousel } from '../../../lib/line/message-templates'
import { QueueManager } from '../../../lib/queue/manager'
import { UserQueries } from '../../../lib/supabase/queries'
import { PremiumChecker } from '../../../lib/premium/premium-checker'
import { logger } from '../../../lib/utils/logger'
import { generateRequestId, generateSessionId, validateLineSignature, generateUrlSignature } from '../../../lib/utils/crypto'
import { getCategoryIdByName } from '../../../lib/conversation/category-definitions'
import { ConversationalFlow, ConversationContext } from '../../../lib/conversation/conversational-flow'
import { CategoryDetector } from '../../../lib/conversation/category-detector'
import { SessionManager } from '../../../lib/conversation/session-manager'
import { LineImageHandler } from '../../../lib/line/image-handler'
import { rateLimiters } from '../../../lib/middleware/rate-limiter'
import { engineerSupport } from '../../../lib/line/engineer-support'
import { aiProvider } from '../../../lib/ai/provider'
import { isSpam } from '../../../lib/middleware/spam-detector'
import { MemoryMonitor } from '../../../lib/monitoring/memory-monitor'
import { RecoveryManager } from '../../../lib/error-recovery/recovery-manager'
import { QAService } from '../../../lib/rag/qa-service'
import { DownloadQueries } from '../../../lib/supabase/subscription-queries'
import { supabaseAdmin } from '../../../lib/supabase/client'
import { startDrip, stopDrip, checkAndStopDripOnUserAction } from '../../../lib/drip/drip-service'
import { handleDiagnosis, isDiagnosisTrigger } from '../../../lib/line/diagnosis-handler'
import { handleConsultation, isConsultationTrigger } from '../../../lib/line/consultation-handler'

// Node.jsランタイムを使用（AI処理のため）
export const runtime = 'nodejs'
export const maxDuration = 30  // Webhookは30秒で応答

const lineClient = new LineApiClient()
const sessionManager = SessionManager.getInstance()
const imageHandler = new LineImageHandler()

// メモリ監視を開始（アプリケーション起動時に一度だけ）
if (typeof process !== 'undefined' && !(global as any).__memoryMonitorStarted) {
  MemoryMonitor.start()
    ; (global as any).__memoryMonitorStarted = true
  logger.info('Memory monitor initialized')
}

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

    // 無限ループ防止: 既に転送されたリクエストは再転送しない
    const isForwarded = req.headers.get('x-forwarded-from')
    if (isForwarded) {
      logger.info('Request already forwarded from: ' + isForwarded + ' - skipping re-forward to prevent infinite loop', { requestId })
    }

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

          // Agency tracking: 既存友達の訪問記録紐付け（非同期、失敗してもメッセージ処理に影響なし）
          const msgUserId = event.source?.userId
          if (msgUserId) {
            linkVisitToLineUser(msgUserId, 'existing_friend').catch(() => { })
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

    // Netlifyに転送（非同期、レスポンスを待たない）
    // 代理店プログラムのコンバージョントラッキング用
    // follow/unfollowイベントのみ転送（messageイベントは転送しない = 無限ループ防止）
    // 既に転送されたリクエストは再転送しない（無限ループ防止）
    const hasFollowEvent = events.some((e: any) => e.type === 'follow' || e.type === 'unfollow')
    if (hasFollowEvent && !isForwarded) {
      forwardToNetlify(body, signature, requestId).catch(err => {
        logger.error('Background forward to Netlify failed', { requestId, err })
      })
    }

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

  // ユーザーがメッセージ送信 → ドリップ配信を停止（自発的なアクションなのでドリップ不要）
  if (userId) {
    checkAndStopDripOnUserAction(userId).catch(() => { })
  }

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
        text: '📸 エラーのスクリーンショットを送信してください。\n\n画像を確認後、エラーの原因と解決方法をお伝えします。\n\n※画像を送信するか、「キャンセル」と入力してください。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
          ]
        }
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
        text: '📸 解析したい画像を送信してください。\n\nスクリーンショット、エラー画面、Excel・PDFのスクショなど、どんな画像でも解析します。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
          ]
        }
      }])
      return true
    }

    // AI診断ハンドラー（diagnosisMode中の回答 or トリガーテキスト）
    if ((context as any)?.diagnosisMode || isDiagnosisTrigger(messageText)) {
      const handled = await handleDiagnosis(userId, messageText, replyToken, context, sessionManager, lineClient)
      if (handled) return true
    }

    // Haiku相談ハンドラー（consultationMode中 or トリガーテキスト）
    if ((context as any)?.consultationMode || isConsultationTrigger(messageText)) {
      const handled = await handleConsultation(userId, messageText, replyToken, context, sessionManager, lineClient)
      if (handled) return true
    }

    // 無料相談予約
    if (messageText === '無料相談を予約' ||
      messageText === '無料相談を予約する' ||
      messageText === '無料で相談する' ||
      messageText === '無料相談で試算する' ||
      messageText.includes('無料相談') && messageText.includes('予約')) {

      const bookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'
      if (bookingUrl) {
        await lineClient.replyMessage(replyToken, [{
          type: 'template',
          altText: '無料相談のご予約',
          template: {
            type: 'buttons',
            text: '15分の無料面談をご予約いただけます。\n\n御社の業務に合った自動化をご提案します。',
            actions: [
              {
                type: 'uri',
                label: '📅 予約ページを開く',
                uri: bookingUrl
              }
            ]
          }
        }] as any)
      } else {
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '📅 無料相談のご予約ありがとうございます！\n\nエンジニアチームに通知しました。\n営業時間内（平日10:00-19:00）に、面談の日程調整のご連絡をさせていただきます。\n\nしばらくお待ちください。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
            ]
          }
        }] as any)
        // エンジニアに面談リクエストを通知
        await engineerSupport.handleSupportRequest(userId, '【面談予約リクエスト】' + messageText, replyToken).catch(() => { })
      }
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

    // エラー修復フィードバック処理
    if (messageText === '動作しました' ||
      messageText === '動作確認OK' ||
      messageText === '✅ 動作確認OK' ||
      messageText.includes('動作') && messageText.includes('OK')) {

      // フィードバック成功を記録
      const recoveryLogId = context ? (context as any).lastRecoveryLogId : undefined
      if (recoveryLogId) {
        const recoveryManager = new RecoveryManager()
        await recoveryManager.recordFeedback(userId, true, recoveryLogId)

        // ログIDをクリア
        if (context) {
          delete (context as any).lastRecoveryLogId
          await sessionManager.saveContext(userId, context)
        }

        logger.info('User feedback recorded: success', { userId, recoveryLogId })
      }

      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '🎉 素晴らしいです！\n\nエラーが解決できて良かったです。\n\n引き続き、何かあればお気軽にご相談ください！',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🔄 新しいコード', text: '新しいコードを作りたい' } },
            { type: 'action', action: { type: 'message', label: '📊 統計を見る', text: 'マイステータス' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }
      }] as any)
      return true
    }

    const signature = await generateUrlSignature(userId)
    // URLエンコードを確実に行う
    const encodedUserId = encodeURIComponent(userId)
    const encodedSignature = encodeURIComponent(signature)
    const myPageUrl = `https://gasgenerator.onrender.com/mypage?uid=${encodedUserId}&sig=${encodedSignature}`

    if (messageText === 'マイページ' ||
      messageText === 'マイステータス' ||
      messageText === 'プラン変更' ||
      messageText === 'プランをダウングレードしたい' || // ユーザーの入力例
      messageText.includes('ダウングレード') ||
      messageText.includes('プラン変更') ||
      messageText.includes('解約') ||
      messageText.includes('退会')) {

      const { data: subscription } = await (await import('../../../lib/supabase/client')).supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .single()

      let feeMessage = 'プラン変更や解約は、セキュリティのため「マイページ」からお手続きをお願いします。'

      if (subscription) {
        const { calculateCancellationFee, formatCurrencyJP } = await import('../../../lib/subscription-utils')
        // 生の日付データがあればそれを使用、なければ文字列
        const startDate = subscription.contract_start_date // DBから取得したままの形式(ISO文字列)
        const feeInfo = calculateCancellationFee(startDate, subscription.current_plan_price)

        if (feeInfo.cancellationFee > 0) {
          feeMessage += `\n\n⚠️ 現在解約すると、最低利用期間の残金として【約${formatCurrencyJP(feeInfo.cancellationFee)}】の違約金が発生する可能性があります。`
        }
      }

      await lineClient.replyMessage(replyToken, [{
        type: 'flex',
        altText: 'マイページへのアクセス',
        contents: {
          type: 'bubble',
          size: 'giga',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '🔑 マイページ',
                weight: 'bold',
                size: 'xl',
                color: '#ffffff'
              },
              {
                type: 'text',
                text: '契約状況の確認・変更',
                size: 'sm',
                color: '#ffffff',
                margin: 'md'
              }
            ],
            backgroundColor: '#06b6d4',
            paddingAll: '20px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: feeMessage,
                wrap: true,
                size: 'md',
                color: '#333333'
              },
              {
                type: 'text',
                text: '※セキュリティのため、以下のボタンから専用ページにアクセスしてください。',
                wrap: true,
                size: 'xs',
                color: '#888888',
                margin: 'lg'
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'マイページを開く',
                  uri: myPageUrl
                },
                style: 'primary',
                color: '#06b6d4',
                height: 'sm'
              },
              {
                type: 'button',
                action: {
                  type: 'message',
                  label: 'メニューに戻る',
                  text: 'メニュー'
                },
                style: 'secondary',
                margin: 'md',
                height: 'sm'
              }
            ]
          }
        }
      }] as any)
      return true
    }

    if (messageText === 'まだエラーが出ます' ||
      messageText === 'まだエラー' ||
      messageText === '❌ まだエラー' ||
      messageText.includes('まだ') && messageText.includes('エラー')) {

      // フィードバック失敗を記録
      const recoveryLogId = context ? (context as any).lastRecoveryLogId : undefined
      if (recoveryLogId) {
        const recoveryManager = new RecoveryManager()
        await recoveryManager.recordFeedback(userId, false, recoveryLogId)

        logger.info('User feedback recorded: failure', { userId, recoveryLogId })
      }

      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '了解しました。もう一度エラーのスクリーンショットを送信してください。\n\n別のアプローチで修正を試みます。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '📷 スクショ送信', text: 'エラーのスクリーンショットを送る' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアに相談', text: 'エンジニアに相談する' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }
      }] as any)
      return true
    }

    // スパム検出（Googleドメインのホワイトリスト対応）
    if (isSpam(messageText)) {
      logger.warn('Spam detected', { userId, messageText: messageText.substring(0, 100) })

      // スパムカウンターをインクリメント（メモリ内で管理）
      const spamCountKey = `spam_${userId}`
      const spamCount = (global as any)[spamCountKey] || 0
        ; (global as any)[spamCountKey] = spamCount + 1

      if (spamCount >= 3) {
        // 3回以上スパムを送信したユーザーは警告
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '⚠️ 不適切なメッセージが検出されました。\n\n続けると利用を制限させていただく場合があります。\n\n正しい使い方は「使い方」と送信してご確認ください。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
              { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
              { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' } },
              { type: 'action', action: { type: 'message', label: '📖 使い方', text: '使い方' } },
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
            ]
          }
        }])

        // 5回以上はブロック対象として記録
        if (spamCount >= 5) {
          logger.error('User blocked for spam', { userId, count: spamCount })
          // usersテーブルにブロック情報を記録
          try {
            await (supabaseAdmin as any)
              .from('users')
              .update({
                blocked_at: new Date().toISOString(),
                blocked_reason: `スパム行為（${spamCount}回の連続送信）`
              })
              .eq('line_user_id', userId)
          } catch (blockError) {
            logger.warn('Failed to record user block', { userId, blockError })
          }
        }
      }

      return true // スパムは処理終了
    }

    // RAG: システム一覧コマンド → カタログページへ誘導（署名付きURL）
    if (messageText === 'システム一覧' || messageText === 'システムカタログ' || messageText === 'システムを見る') {
      // 署名付きURLでカタログページにユーザー情報を渡す
      const encodedUserId = btoa(userId)
      const timestamp = Date.now().toString()
      const sig = await generateUrlSignature(`${encodedUserId}:${timestamp}`)
      const catalogUrl = `https://gasgenerator.onrender.com/systems/catalog?u=${encodeURIComponent(encodedUserId)}&t=${timestamp}&s=${sig}`

      // Flex Messageでカタログページへのリンクを表示
      await lineClient.replyMessage(replyToken, [{
        type: 'flex',
        altText: 'システムカタログ',
        contents: {
          type: 'bubble',
          hero: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '📦 システムカタログ',
                weight: 'bold',
                size: 'xl',
                color: '#ffffff'
              },
              {
                type: 'text',
                text: '各システムをプレビューで実際に触れます',
                size: 'sm',
                color: '#ffffff',
                margin: 'md'
              }
            ],
            backgroundColor: '#06b6d4',
            paddingAll: '20px'
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: '利用可能なシステム',
                weight: 'bold',
                size: 'md',
                margin: 'none'
              },
              {
                type: 'separator',
                margin: 'md'
              },
              {
                type: 'box',
                layout: 'vertical',
                margin: 'md',
                contents: [
                  {
                    type: 'text',
                    text: '01 営業日報システム',
                    size: 'sm',
                    color: '#555555'
                  },
                  {
                    type: 'text',
                    text: '02 失客アラートシステム',
                    size: 'sm',
                    color: '#555555',
                    margin: 'sm'
                  }
                ]
              },
              {
                type: 'text',
                text: '※プレビュー画面で実際に操作できます',
                size: 'xs',
                color: '#aaaaaa',
                margin: 'lg'
              }
            ]
          },
          footer: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: 'カタログを見る',
                  uri: catalogUrl
                },
                style: 'primary',
                color: '#06b6d4'
              }
            ]
          }
        }
      }] as any)

      logger.info('System catalog link sent', { userId, catalogUrl })
      return true
    }

    // ===================================================================
    // ダウンロードコマンド処理
    // パターン: 「○○をダウンロード」「○○ ダウンロード」「DL:システム名」
    // ===================================================================
    const downloadPatterns = [
      /^(.+)をダウンロード$/,
      /^(.+)\s*ダウンロード$/,
      /^DL[:：]\s*(.+)$/i,
      /^ダウンロード[:：]\s*(.+)$/
    ]

    let downloadSystemName: string | null = null
    for (const pattern of downloadPatterns) {
      const match = messageText.match(pattern)
      if (match) {
        downloadSystemName = match[1].trim()
        break
      }
    }

    if (downloadSystemName) {
      try {
        logger.info('Download request detected', { userId, systemName: downloadSystemName })

        // ローディング表示
        lineClient.showLoadingAnimation(userId, 30).catch(() => { })

        // 全角⇔半角を正規化して検索精度を向上
        const normalizeWidth = (s: string) => s
          .replace(/（/g, '(').replace(/）/g, ')').replace(/＋/g, '+')
          .replace(/：/g, ':').replace(/／/g, '/').replace(/　/g, ' ')
        const normalizedName = normalizeWidth(downloadSystemName)

        // 1. システム名でDBから検索（名前の部分一致）
        let { data: systems, error: searchError } = await (await import('../../../lib/supabase/client')).supabaseAdmin
          .from('systems')
          .select('*')
          .ilike('name', `%${downloadSystemName}%`)
          .eq('is_published', true)
          .limit(1)

        // 1b. 見つからない場合、正規化した名前で再検索
        if ((!systems || systems.length === 0) && normalizedName !== downloadSystemName) {
          const retry = await (await import('../../../lib/supabase/client')).supabaseAdmin
            .from('systems')
            .select('*')
            .ilike('name', `%${normalizedName}%`)
            .eq('is_published', true)
            .limit(1)
          if (retry.data && retry.data.length > 0) {
            systems = retry.data
            searchError = retry.error
          }
        }

        if (searchError || !systems || systems.length === 0) {
          // 1c. DBに無い場合、カタログデータ(systems-data.ts)で確認
          const { getSystemsData, getSpreadsheetUrl } = await import('../../../lib/data/systems-data')
          const catalogSystems = getSystemsData()
          const catalogMatch = catalogSystems.find(s =>
            s.name === downloadSystemName ||
            normalizeWidth(s.name) === normalizedName
          )

          if (catalogMatch) {
            const sheetUrl = getSpreadsheetUrl(catalogMatch.id)
            const catalogUrl = `https://gasgenerator.onrender.com/systems/catalog?id=${catalogMatch.id}`

            // サブスクリプション判定（usersテーブルで統一）
            const { data: catUser } = await supabaseAdmin
              .from('users')
              .select('subscription_status, subscription_end_date')
              .eq('line_user_id', userId)
              .maybeSingle()

            const catUserIsPaid = catUser &&
              (catUser.subscription_status === 'premium' || catUser.subscription_status === 'professional') &&
              catUser.subscription_end_date &&
              new Date(catUser.subscription_end_date) > new Date()

            if (!catUserIsPaid) {
              // 無料ユーザー → 有料プラン案内（カタログ閲覧は可能）
              const paidOnlyBookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'
              await lineClient.replyMessage(replyToken, [{
                type: 'text',
                text: `このシステム、カタログページで動いている実物をご確認いただけます。\n\n💰 投資対効果\n月20時間の手作業を自動化した場合：\n・時給2,500円 × 20時間 = 月5万円分の価値\n・月額1万円の投資で、5倍のリターン\n・導入初月で投資回収\n\n✅ 動作不良時は全額返金保証\n✅ 最短5分で導入完了\n✅ プログラミング知識不要\n\n気になる点は15分の無料相談で何でも確認できます。`,
                quickReply: {
                  items: [
                    { type: 'action', action: { type: 'uri', label: '📅 15分無料相談を予約', uri: paidOnlyBookingUrl } },
                    { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアにLINE質問', text: 'エンジニアに相談する' } },
                    { type: 'action', action: { type: 'message', label: '💎 料金プランを見る', text: '料金プラン' } },
                    { type: 'action', action: { type: 'uri', label: '📦 カタログで見る', uri: catalogUrl } },
                    { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
                  ]
                }
              }] as any)
              return true
            }

            // ダウンロード回数チェック（有料プランのみ）
            const dlSubscriptionStatus = catUser.subscription_status
            const { checkAndRecordDownload: catCheckDL } = await import('../../../lib/download/download-limiter')
            const catDlResult = await catCheckDL(userId, dlSubscriptionStatus, catalogMatch.id, catalogMatch.name)
            if (!catDlResult.allowed) {
              const planLabel = catUser?.subscription_status === 'professional' ? '5万円プラン' : '1万円プラン'
              const periodLabel = catUser?.subscription_status === 'premium' ? '2か月に' : '月'
              const resetLabel = catUser?.subscription_status === 'premium' ? '次の2か月サイクル' : '来月'
              await lineClient.replyMessage(replyToken, [{
                type: 'text',
                text: `今期のダウンロード上限に達しました。\n\n現在のプラン: ${planLabel}（${periodLabel}${catDlResult.limit}回）\n次回リセット: ${resetLabel}\n\nより多くのシステムが必要な場合は、プランのアップグレードをご検討ください。\nご不明点はエンジニアにお気軽にどうぞ。`,
                quickReply: {
                  items: [
                    { type: 'action', action: { type: 'message', label: '💎 プランをアップグレード', text: '料金プラン' } },
                    { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアにLINE質問', text: 'エンジニアに相談する' } },
                    { type: 'action', action: { type: 'uri', label: '📦 カタログで見る', uri: catalogUrl } },
                    { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
                  ]
                }
              }] as any)
              return true
            }

            // 有料ユーザー → スプレッドシートURL提供
            if (sheetUrl) {
              const catDlBookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'
              await lineClient.replyMessage(replyToken, [{
                type: 'flex',
                altText: `${catalogMatch.name} ダウンロード`,
                contents: {
                  type: 'bubble',
                  size: 'kilo',
                  body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      { type: 'text', text: '✅ ダウンロード', weight: 'bold', size: 'md', color: '#10b981' },
                      { type: 'text', text: catalogMatch.name, weight: 'bold', size: 'sm', margin: 'sm', wrap: true },
                      { type: 'text', text: '「コピーを作成」でご自身のGoogleドライブに保存してください。', size: 'xs', color: '#666666', wrap: true, margin: 'md' },
                    ],
                    paddingAll: '15px',
                  },
                  footer: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                      { type: 'button', action: { type: 'uri', label: 'スプレッドシートを開く', uri: sheetUrl }, style: 'primary', color: '#10b981', height: 'sm' },
                    ],
                    paddingAll: '12px',
                  },
                },
                quickReply: {
                  items: [
                    { type: 'action', action: { type: 'uri', label: '📅 設定サポート相談', uri: catDlBookingUrl } },
                    { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアに質問', text: 'エンジニアに相談する' } },
                    { type: 'action', action: { type: 'message', label: '🔍 他のシステムも診断', text: 'AI診断' } },
                    { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
                    { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
                  ]
                },
              }] as any)
            } else {
              await lineClient.replyMessage(replyToken, [{
                type: 'text',
                text: `📦 「${catalogMatch.name}」は現在準備中です。\n\n完成次第ダウンロード可能になります。`,
                quickReply: {
                  items: [
                    { type: 'action', action: { type: 'uri', label: '📦 カタログで見る', uri: catalogUrl } },
                    { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
                  ]
                }
              }] as any)
            }
            return true
          }

          // どこにも見つからない
          await lineClient.replyMessage(replyToken, [{
            type: 'text',
            text: `❌ 「${downloadSystemName}」というシステムが見つかりませんでした。\n\nシステムカタログで正確な名前を確認してください。`,
            quickReply: {
              items: [
                { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
                { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
              ]
            }
          }] as any)
          return true
        }

        const system = systems[0]
        logger.info('System found', { userId, systemId: system.id, systemName: system.name })

        // 2. usersテーブルでサブスクリプション判定（単一の真実のソース）
        const { data: dlUser } = await supabaseAdmin
          .from('users')
          .select('subscription_status, subscription_end_date')
          .eq('line_user_id', userId)
          .maybeSingle()

        const isPaidUser = dlUser &&
          (dlUser.subscription_status === 'premium' || dlUser.subscription_status === 'professional') &&
          dlUser.subscription_end_date &&
          new Date(dlUser.subscription_end_date) > new Date()

        if (!isPaidUser) {
          const dbFreeBookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'
          await lineClient.replyMessage(replyToken, [{
            type: 'text',
            text: `ご利用ありがとうございます。\n\nこのシステムで月20時間の削減が見込めます。\n\n💰 投資対効果\n月額1万円の投資で、毎月5万円分の時間を取り戻せます。\n（時給2,500円 × 月20時間削減の場合）\n\n▼ まずは確認してみませんか？\n✅ カタログで動いている実物を確認できます\n✅ 15分の無料相談で御社に合うか判定\n✅ 動作不良時は全額返金保証あり`,
            quickReply: {
              items: [
                { type: 'action', action: { type: 'uri', label: '📅 15分無料相談を予約', uri: dbFreeBookingUrl } },
                { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアにLINE質問', text: 'エンジニアに相談する' } },
                { type: 'action', action: { type: 'message', label: '💎 料金プランを見る', text: '料金プラン' } },
                { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
                { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
              ]
            }
          }] as any)
          return true
        }

        // ダウンロード回数チェック
        const { checkAndRecordDownload: dbCheckDL } = await import('../../../lib/download/download-limiter')
        const dbDlResult = await dbCheckDL(userId, dlUser.subscription_status, system.id, system.name)
        if (!dbDlResult.allowed) {
          const dbPlanLabel = dlUser.subscription_status === 'professional' ? '5万円プラン' : '1万円プラン'
          const dbPeriodLabel = dlUser.subscription_status === 'premium' ? '2か月に' : '月'
          const dbResetLabel = dlUser.subscription_status === 'premium' ? '次の2か月サイクル' : '来月'
          await lineClient.replyMessage(replyToken, [{
            type: 'text',
            text: `今期のダウンロード上限に達しました。\n\n現在のプラン: ${dbPlanLabel}（${dbPeriodLabel}${dbDlResult.limit}回）\n次回リセット: ${dbResetLabel}\n\nより多くのシステムが必要な場合は、プランのアップグレードをご検討ください。\nご不明点はエンジニアにお気軽にどうぞ。`,
            quickReply: {
              items: [
                { type: 'action', action: { type: 'message', label: '💎 プランをアップグレード', text: '料金プラン' } },
                { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアにLINE質問', text: 'エンジニアに相談する' } },
                { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
                { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
              ]
            }
          }] as any)
          return true
        }

        // 4. GASコードを送信
        const codeContent = system.code_content || '// このシステムのコードは準備中です。\n// 近日中に公開予定です。'
        const setupInstructions = system.setup_instructions || 'セットアップ手順は準備中です。'

        // コードが長い場合は分割して送信
        const MAX_CODE_LENGTH = 4000
        const isCodeLong = codeContent.length > MAX_CODE_LENGTH

        // Flexメッセージでコードを送信
        const flexMessage = {
          type: 'flex',
          altText: `${system.name} - GASコード`,
          contents: {
            type: 'bubble',
            size: 'giga',
            header: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '✅ ダウンロード完了',
                  weight: 'bold',
                  size: 'lg',
                  color: '#ffffff'
                },
                {
                  type: 'text',
                  text: system.name,
                  size: 'md',
                  color: '#ffffff',
                  margin: 'sm'
                }
              ],
              backgroundColor: '#10b981',
              paddingAll: '15px'
            },
            body: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: '📋 GASコード',
                  weight: 'bold',
                  size: 'md',
                  margin: 'none'
                },
                {
                  type: 'box',
                  layout: 'vertical',
                  contents: [
                    {
                      type: 'text',
                      text: isCodeLong
                        ? codeContent.substring(0, MAX_CODE_LENGTH) + '\n\n... (続きは次のメッセージ)'
                        : codeContent,
                      size: 'xs',
                      color: '#333333',
                      wrap: true
                    }
                  ],
                  backgroundColor: '#f3f4f6',
                  cornerRadius: 'md',
                  paddingAll: '12px',
                  margin: 'md'
                },
                {
                  type: 'separator',
                  margin: 'lg'
                },
                {
                  type: 'text',
                  text: '📝 セットアップ手順',
                  weight: 'bold',
                  size: 'sm',
                  margin: 'lg'
                },
                {
                  type: 'text',
                  text: setupInstructions.length > 500
                    ? setupInstructions.substring(0, 500) + '...'
                    : setupInstructions,
                  size: 'xs',
                  color: '#666666',
                  wrap: true,
                  margin: 'sm'
                }
              ],
              paddingAll: '15px'
            },
            footer: {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: `プラン: ${dlUser?.subscription_status === 'professional' ? 'プロフェッショナル' : 'プレミアム'}`,
                  size: 'xs',
                  color: '#888888',
                  align: 'center'
                }
              ],
              paddingAll: '10px'
            }
          }
        }

        const dlBookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'
        const dlFollowUpQuickReply = {
          items: [
            { type: 'action', action: { type: 'uri', label: '📅 設定サポート相談', uri: dlBookingUrl } },
            { type: 'action', action: { type: 'message', label: '🔍 他のシステムも診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }

        const messages: any[] = [flexMessage]

        // フォローアップメッセージ追加
        const followUpText = `セットアップでお困りの際は、お気軽にご相談ください。\n15分の無料相談で設定をサポートします。`

        // コードが長い場合は続きを送信
        if (isCodeLong) {
          messages.push({
            type: 'text',
            text: `📋 続き:\n\n${codeContent.substring(MAX_CODE_LENGTH)}`
          })
          messages.push({
            type: 'text',
            text: followUpText,
            quickReply: dlFollowUpQuickReply
          })
        } else {
          messages.push({
            type: 'text',
            text: followUpText,
            quickReply: dlFollowUpQuickReply
          })
        }

        await lineClient.replyMessage(replyToken, messages)

        logger.info('Download completed', {
          userId,
          systemId: system.id,
          systemName: system.name,
        })

        return true

      } catch (error) {
        logger.error('Download handler error', { error, userId, systemName: downloadSystemName })

        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '❌ エラーが発生しました。時間をおいて再度お試しください。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
              { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } }
            ]
          }
        }] as any)
        return true
      }
    }

    // RAG: システムに関する質問検出
    const ragQueryPattern = /(.+)(について|とは|って何|の使い方|の機能|の特徴|を教えて|の説明)/
    const ragMatch = messageText.match(ragQueryPattern)

    if (ragMatch && messageText.length >= 5 && messageText.length <= 100) {
      const querySubject = ragMatch[1].trim()

      // システム名らしい質問かチェック（一般的な質問は除外）
      const generalQuestions = ['使い方', 'ヘルプ', 'メニュー', '料金', 'プラン', 'GAS', 'TaskMate']
      const isSystemQuery = !generalQuestions.some(g => querySubject.includes(g))

      if (isSystemQuery) {
        try {
          logger.info('RAG query detected', { userId, query: messageText })

          // ローディングアニメーション開始
          lineClient.showLoadingAnimation(userId, 30).catch(err => {
            logger.debug('Failed to show loading for RAG', { err })
          })

          // RAGで回答生成
          const result = await QAService.answerQuestion(messageText)

          if (result.sources.length > 0) {
            // ソースが見つかった場合は回答を表示（信頼度に関わらず）
            const confidenceLabel = result.confidence === 'high' ? '✅' : result.confidence === 'medium' ? '📝' : '💡'
            const sourceInfo = result.sources.length > 0
              ? `\n\n📚 参照: ${result.sources[0].doc_title || 'ドキュメント'}`
              : ''

            await lineClient.replyMessage(replyToken, [{
              type: 'text',
              text: `${confidenceLabel} ${result.answer}${sourceInfo}`,
              quickReply: {
                items: [
                  { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
                  { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
                  { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
                ]
              }
            }] as any)

            logger.info('RAG answer sent', {
              userId,
              confidence: result.confidence,
              searchMethod: result.search_method,
              sourcesCount: result.sources.length
            })
            return true
          }
          // 信頼度が低い場合は通常フローに継続
          logger.info('RAG confidence too low, falling back to normal flow', {
            userId,
            confidence: result.confidence
          })
        } catch (error) {
          logger.error('RAG query error', { error })
          // エラー時は通常フローに継続
        }
      }
    }

    // 会話の最初のターンかどうかを判定
    const isFirstTurn = !context && !isResetCommand(messageText)

    // 最初のターンで、既知のコマンドではない場合はLLMで自然な返答
    if (isFirstTurn &&
      messageText.length >= 2 &&
      messageText.length <= 200 &&
      !getCategoryIdByName(messageText) &&
      !['メニュー', 'menu', '使い方', 'ヘルプ', '料金プラン', 'プレミアムプラン', 'プレミアムプランを見る', 'アップグレード'].includes(messageText.toLowerCase())) {

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

        const finalResponse = await aiProvider.sendMessage(messages, userId, 1, 300)

        const responseText = finalResponse.content[0].text

        // メインメニューquickReplyを使用（システム一覧を先頭に配置）
        const llmBookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: responseText,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
              { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
              { type: 'action', action: { type: 'uri', label: '📅 無料相談を予約', uri: llmBookingUrl } },
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
              { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
              { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
            ]
          }
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
      const menuBookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '📋 メニュー\n\n🔍 AI診断 … 30秒で最適なシステムを診断\n📦 システム一覧 … 119種類の自動化システム\n📅 無料相談 … 15分で導入プランをご提案\n🚀 コード生成 … AIがGASコードを自動作成\n💎 料金プラン … 無料/プレミアム/プロ',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'uri', label: '📅 無料相談を予約', uri: menuBookingUrl } },
            { type: 'action', action: { type: 'message', label: '🚀 コード生成開始', text: 'コード生成を開始' } },
            { type: 'action', action: { type: 'message', label: '💎 料金プラン', text: '料金プラン' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談' } },
            { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } }
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
      /chatgpt|gpt-?4|claude|gemini|copilot/.test(normalizedText) ||
      normalizedText.includes('チャットgpt') ||
      normalizedText.includes('チャットジーピーティー') ||
      normalizedText.includes('クロード') ||
      normalizedText.includes('ジェミニ') ||
      normalizedText.includes('コパイロット')

    // 比較を意図する文脈の検出（厳格化: 明確な比較キーワードのみ）
    const hasComparisonIntent =
      /違いは何|違いを教|差を教|比較して|どちらが良い|どっちが良い|メリットは何|優れている点/.test(normalizedText) ||
      (normalizedText.includes('違い') && (normalizedText.includes('何') || normalizedText.includes('教え'))) ||
      (normalizedText.includes('比較') && normalizedText.length < 50) ||
      normalizedText.includes('vs') ||
      normalizedText.includes('versus')

    // TaskMate自体への言及を除外（自己言及は比較対象外）
    const isSelfReference =
      normalizedText.includes('taskmate') ||
      normalizedText.includes('タスクメイト') ||
      normalizedText.includes('たすくめいと')

    // エラー修正・コード依頼を除外（誤検知防止）
    const isCodeRequest =
      normalizedText.includes('エラー') ||
      normalizedText.includes('修正') ||
      normalizedText.includes('直し') ||
      normalizedText.includes('コード') ||
      normalizedText.includes('作成') ||
      normalizedText.includes('生成') ||
      normalizedText.includes('スクショ') ||
      normalizedText.includes('スクリーンショット')

    if (hasLLMService && hasComparisonIntent && !isSelfReference && !isCodeRequest) {

      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: 'TaskMateと他のLLMサービスの本質的な違い\n\n【TaskMateにしかない強み】\n\n1. 無制限の会話履歴と文脈保持\nTaskMateは全ての会話履歴を永続的に保存。1ヶ月前の続きから再開可能。他のLLMは会話が長くなると文脈を失い、最初から説明し直す必要があります。\n\n2. 現役PMエンジニアへの直接相談\n「エンジニアに相談」ボタンで、10年以上の実務経験を持つフルスタックエンジニアが直接対応。複雑な要件も一緒に設計から考えます。他のLLMではAIのみの対応です。\n\n3. 修正履歴の完全管理\n過去に生成した全てのコードを記憶し、修正要望も文脈を保持したまま対応。「先週作ったコードの〇〇を修正」といった依頼も可能。\n\n4. LINE完結の業務フロー\nスクショ送信→コード生成→動作確認→修正依頼まで全てLINE内で完結。ブラウザを開く必要なし。\n\n5. 実装サポートまで含む\n生成したコードの実装方法、エラー対処、カスタマイズまで一貫してサポート。孤独な試行錯誤は不要です。\n\n【使い分けの目安】\n・他のLLM：調査や学習向き\n・TaskMate：実務で今すぐ使えるコードと実装サポートが必要な方向き',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
            { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
            { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
            { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
            { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
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
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
            { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
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
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
            { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }
      }])
      return true
    }

    // 無料プランを継続ボタン押下時のROI訴求ハンドラー
    if (messageText === '無料プランを継続') {
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: '現在、無料プランをご利用中です。\n\nプレミアムプランにアップグレードすると、月20時間の業務削減が可能です。時給2,500円換算で月5万円分の価値があります。\n\n✅ コード生成が無制限に\n✅ 2ヶ月に1回、完成システムをDL\n✅ 優先サポートでトラブル即解決\n\nまずは無料相談で、あなたの業務に合う自動化をご提案します。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'uri', label: '📅 無料相談を予約', uri: process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949' } },
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'message', label: '💎 料金プラン', text: '料金プラン' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }
      }] as any)
      return true
    }

    if (messageText === 'プレミアムプラン' || messageText === 'プレミアムプランを見る' || messageText === '料金プラン' || messageText === 'アップグレード') {
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
                text: '✅ 月10回まで生成\n✅ 全機能利用可能\n✅ 画像解析対応\n✅ AI診断で最適システム提案\n\n月額 0円',
                actions: [{
                  type: 'message',
                  label: currentStatus.isPremium || currentStatus.isProfessional ? 'ダウングレード' : '現在のプラン',
                  text: currentStatus.isPremium || currentStatus.isProfessional ? 'プランをダウングレードしたい' : '無料プランを継続'
                }]
              },
              {
                title: '💎 プレミアム（人気No.1）',
                text: '月5万円分を1万円で\n返金保証あり\n\n✅ 無制限コード生成\n✅ システムDL\n✅ 優先サポート\n\n月額 10,000円',
                actions: [currentStatus.isPremium ? {
                  type: 'message',
                  label: 'チャットで相談',
                  text: 'エンジニアに相談する'
                } : {
                  type: 'uri',
                  label: '詳細を見る',
                  uri: `https://gasgenerator.onrender.com/terms?plan=premium&user_id=${userId}`
                }]
              },
              {
                title: '🎆 プロフェッショナル',
                text: '専任エンジニア付きで外注費の1/10\n\n✅ 全機能無制限\n✅ 月3回システムDL\n✅ 24時間以内対応\n\n月額 50,000円',
                actions: [currentStatus.isProfessional ? {
                  type: 'message',
                  label: 'チャットで相談',
                  text: 'エンジニアに相談する'
                } : {
                  type: 'uri',
                  label: '詳細を見る',
                  uri: `https://gasgenerator.onrender.com/terms?plan=professional&user_id=${userId}`
                }]
              }
            ]
          }
        },
        {
          type: 'text',
          text: '💰 投資対効果\n\n月20時間の手作業を自動化した場合：\n・時給2,500円 × 20時間 = 月5万円分の価値\n・月額1万円の投資で、5倍のリターン\n・導入初月で投資回収\n\nプランについてご不明点があれば、無料相談をご利用ください。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'uri', label: '📅 無料相談を予約', uri: process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949' } },
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
              { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
              { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
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
            { type: 'action', action: { type: 'message', label: '👨‍💻 サポートに相談', text: 'エンジニアに相談' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
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
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } },
              { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } }
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
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } },
              { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' } }
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
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } },
              { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' } }
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
              { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
              { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
              { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
              { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
              { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
              { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
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
        text: '申し訳ございません。エラーが発生しました。\n下のボタンから操作を選んでください。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } },
            { type: 'action', action: { type: 'message', label: '📷 エラー画面', text: 'エラーのスクショを送る' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }
      }] as any)
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
        { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
        { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
        { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
        { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
        { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' } }
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
        { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } }
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
          { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
          { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
          { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
          { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
          { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' } },
          { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアに相談', text: 'エンジニアに相談' } },
          { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
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
            { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } }
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
      ; (context as any).isAddingDescription = false

    // SessionManager経由で更新
    await sessionManager.saveContext(userId, context)

    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `✅ 追加説明を受け付けました。\n\n【画像の内容】\n${context.requirements.imageContent}\n\n【追加説明】\n${messageText}\n\nこの内容でコードを生成します。よろしいですか？`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい' } },
          { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' } },
          { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } }
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
            { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } },
            { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } }
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
      ; (context as any).isModifying = false

    // SessionManager経由で更新
    await sessionManager.saveContext(userId, context)

    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `修正内容を確認しました：\n\n「${messageText}」\n\nこの修正を反映してコードを再生成します。よろしいですか？`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい' } },
          { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' } },
          { type: 'action', action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' } }
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

    // 応答送信 - isCompleteの時は確認ボタン、それ以外はメインメニュー
    const quickReplyItems = result.isComplete ? [
      { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい' } },
      { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' } },
      { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } }
    ] : [
      { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
      { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
      { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
      { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
      { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' } },
      { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
      { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
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
      text: 'もう少し詳しく教えていただけますか？\n\nどのような処理を自動化したいですか？',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📊 スプレッドシート', text: 'スプレッドシート操作' } },
          { type: 'action', action: { type: 'message', label: '📧 Gmail', text: 'Gmail自動化' } },
          { type: 'action', action: { type: 'message', label: '📅 カレンダー', text: 'カレンダー連携' } },
          { type: 'action', action: { type: 'message', label: '🔗 API', text: 'API連携' } },
          { type: 'action', action: { type: 'message', label: '✨ その他', text: 'その他' } },
          { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
          { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
        ]
      }
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
    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: '🚀 コード生成を開始しました！\n\n⏰ 2-3分で完成します\n完了したら自動通知でお知らせします\n\n📖 待ち時間にこちらの記事もどうぞ ↓'
      },
      createWaitingTimeCarousel()
    ])

    logger.info('Code generation started with waiting time carousel', { userId, jobId: job.id })

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
    const isNewUser = (user as any)?.isNewUser

    // 既にプレミアムユーザーかチェック
    const isPremium = (user as any)?.subscription_status === 'premium' &&
      (user as any)?.subscription_end_date &&
      new Date((user as any).subscription_end_date) > new Date()

    if (isPremium) {
      // プレミアムユーザーには活用相談への誘導を含むウェルカムメッセージを表示
      const success = await lineClient.pushMessage(userId, [{
        type: 'text',
        text: '🎉 おかえりなさい！\n\nプレミアムプランご利用中です。\n無制限でGASコードを生成できます。\n\n新しいシステムの追加や活用のご相談もお気軽にどうぞ。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'uri', label: '📅 活用相談を予約', uri: process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949' } },
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニア相談', text: 'エンジニアに相談する' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }
      }])

      if (!success) {
        throw new Error('Failed to send premium welcome message')
      }
    } else if (isNewUser) {
      // 新規無料ユーザー: シンプルなウェルカムメッセージ1通
      const welcomeMessages = MessageTemplates.createWelcomeMessage()
      for (let i = 0; i < welcomeMessages.length; i++) {
        const success = await lineClient.pushMessage(userId, [welcomeMessages[i]])
        if (!success) {
          throw new Error(`Failed to send welcome message ${i + 1}/${welcomeMessages.length}`)
        }
        if (i < welcomeMessages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      // ドリップ配信開始（7日間ステップ配信）
      await startDrip(userId)
    } else {
      // 既存無料ユーザー（ブロック解除/再追加）: シンプルな「おかえり」メッセージ1通
      const success = await lineClient.pushMessage(userId, [{
        type: 'text',
        text: 'おかえりなさい！\n\nまたご利用いただきありがとうございます。\n\n前回気になったシステムはありましたか？\n15分の無料相談で、御社に合った導入プランをご提案します。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'uri', label: '📅 無料相談を予約', uri: process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949' } },
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
          ]
        }
      }])
      if (!success) {
        logger.error('Failed to send returning welcome message', { userId })
      }

      // 復帰ユーザーにもドリップ配信開始（再エンゲージメント）
      await startDrip(userId)
    }

    // Agency tracking: LINE profile保存 + 訪問記録紐付け（非同期、失敗しても影響なし）
    upsertLineProfile(userId).catch(() => { })
    linkVisitToLineUser(userId, 'new_friend').catch(() => { })

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

  // ブロック時にドリップ配信を停止
  await stopDrip(userId, 'unfollowed').catch(() => { })

  // セッションクリーンアップ
  await sessionManager.deleteSession(userId)
}

// ============================================
// Agency Tracking Visit Linking
// (Render側で直接処理 - Netlify転送に依存しない)
// ============================================

/**
 * LINE プロフィールを取得して line_profiles テーブルに upsert
 */
async function upsertLineProfile(lineUserId: string): Promise<string | null> {
  try {
    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!accessToken) return null

    const response = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!response.ok) {
      logger.error('LINE profile fetch failed for tracking', { status: response.status, lineUserId })
      return null
    }

    const profile = await response.json()

    const { error } = await supabaseAdmin
      .from('line_profiles')
      .upsert({
        user_id: lineUserId,
        display_name: profile.displayName,
        picture_url: profile.pictureUrl,
        status_message: profile.statusMessage,
        language: profile.language,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (error) {
      logger.error('line_profiles upsert error', { error: error.message })
    }

    return profile.displayName || null
  } catch (error) {
    logger.error('upsertLineProfile error', { error: error instanceof Error ? error.message : String(error) })
    return null
  }
}

/**
 * 未紐付けの訪問記録をLINEユーザーに紐付け（知能型IP逆引き）
 *
 * 戦略:
 * 1. まずこのユーザーの既知IP（過去にリンク済みの訪問から）を取得
 * 2. 既知IPがあれば、同じIPの全未紐付け訪問をバックフィル（全tracking_link横断）
 * 3. 既知IPがなければ、時間ベースで直近の未紐付け訪問1件をリンク → そのIPでバックフィル
 */
async function linkVisitToLineUser(
  lineUserId: string,
  friendType: 'new_friend' | 'existing_friend'
): Promise<void> {
  try {
    logger.info('Agency visit linking started (IP reverse lookup)', { lineUserId, friendType })

    // Step 1: このユーザーの既知IPを取得
    const { data: knownVisits } = await supabaseAdmin
      .from('agency_tracking_visits')
      .select('visitor_ip')
      .eq('line_user_id', lineUserId)
      .not('visitor_ip', 'is', null)

    const knownIPs = [...new Set(
      (knownVisits || [])
        .map(v => (v.visitor_ip || '').split(',')[0].trim())
        .filter(ip => ip && ip !== 'unknown' && ip !== '127.0.0.1')
    )]

    if (knownIPs.length > 0) {
      // Step 2a: 既知IPで全未紐付け訪問をバックフィル
      logger.info(`Known IPs for user: ${knownIPs.join(', ')}`)
      let totalBackfilled = 0

      for (const ip of knownIPs) {
        const { data: backfilled } = await supabaseAdmin
          .from('agency_tracking_visits')
          .update({
            line_user_id: lineUserId,
            metadata: {
              friend_type: friendType,
              linked_at: new Date().toISOString(),
              match_method: 'ip_reverse_lookup'
            }
          })
          .or(`visitor_ip.eq.${ip},visitor_ip.like.${ip},%`)
          .is('line_user_id', null)
          .select('id')

        if (backfilled && backfilled.length > 0) {
          totalBackfilled += backfilled.length
          for (const v of backfilled) {
            await createAgencyConversion(v, lineUserId).catch(() => { })
          }
        }
      }

      logger.info(`IP reverse lookup backfilled ${totalBackfilled} visits for ${lineUserId}`)
    } else {
      // Step 2b: 既知IPなし → 時間ベースで直近の訪問をリンク
      const timeWindow = friendType === 'new_friend'
        ? 7 * 24 * 60 * 60 * 1000   // フォロー: 7日
        : 7 * 24 * 60 * 60 * 1000   // メッセージ: 7日（1時間→7日に延長）
      const sinceTime = new Date(Date.now() - timeWindow).toISOString()

      const { data: visits, error } = await supabaseAdmin
        .from('agency_tracking_visits')
        .select('id, tracking_link_id, agency_id, device_type, browser, os, created_at, metadata, visitor_ip')
        .is('line_user_id', null)
        .gte('created_at', sinceTime)
        .order('created_at', { ascending: false })
        .limit(5)

      if (error) {
        logger.error('Agency visit search error', { error: error.message })
        return
      }

      if (!visits || visits.length === 0) {
        logger.info('No unlinked agency visits found', { friendType, since: sinceTime })
        return
      }

      // 直近の1件をリンク
      const targetVisit = visits[0]
      const currentMetadata = targetVisit.metadata || {}

      const { error: updateError } = await supabaseAdmin
        .from('agency_tracking_visits')
        .update({
          line_user_id: lineUserId,
          metadata: {
            ...currentMetadata,
            friend_type: friendType,
            linked_at: new Date().toISOString(),
            match_method: friendType === 'new_friend' ? 'follow_event_render' : 'message_event_render'
          }
        })
        .eq('id', targetVisit.id)
        .is('line_user_id', null)

      if (updateError) {
        logger.error('Agency visit update error', { visitId: targetVisit.id, error: updateError.message })
      } else {
        logger.info(`Agency visit linked: ${targetVisit.id} ← ${lineUserId} (${friendType})`)
        await createAgencyConversion(targetVisit, lineUserId).catch(() => { })

        // Step 3: リンクした訪問のIPで追加バックフィル
        const linkedIP = (targetVisit.visitor_ip || '').split(',')[0].trim()
        if (linkedIP && linkedIP !== 'unknown' && linkedIP !== '127.0.0.1') {
          const { data: backfilled } = await supabaseAdmin
            .from('agency_tracking_visits')
            .update({ line_user_id: lineUserId })
            .or(`visitor_ip.eq.${linkedIP},visitor_ip.like.${linkedIP},%`)
            .is('line_user_id', null)
            .select('id')

          if (backfilled && backfilled.length > 0) {
            logger.info(`Time-based + IP backfilled ${backfilled.length} additional visits`)
          }
        }
      }
    }
  } catch (error) {
    logger.error('linkVisitToLineUser error', { error: error instanceof Error ? error.message : String(error) })
  }
}

/**
 * 代理店コンバージョン記録を作成
 */
async function createAgencyConversion(visit: any, lineUserId: string): Promise<void> {
  try {
    // 重複チェック
    const { data: existing } = await supabaseAdmin
      .from('agency_conversions')
      .select('id')
      .eq('visit_id', visit.id)
      .eq('conversion_type', 'line_friend')
      .maybeSingle()

    if (existing) return

    // line_profilesからLINE表示名を取得（LINE API呼び出しを避ける）
    let displayName: string | null = null
    const { data: profile } = await supabaseAdmin
      .from('line_profiles')
      .select('display_name')
      .eq('user_id', lineUserId)
      .maybeSingle()

    if (profile) {
      displayName = profile.display_name
    }

    const { error } = await supabaseAdmin
      .from('agency_conversions')
      .insert([{
        agency_id: visit.agency_id,
        tracking_link_id: visit.tracking_link_id,
        visit_id: visit.id,
        line_user_id: lineUserId,
        line_display_name: displayName,
        device_type: visit.device_type || null,
        browser: visit.browser || null,
        os: visit.os || null,
        conversion_type: 'line_friend',
        conversion_value: 0,
        metadata: { linked_at: new Date().toISOString() }
      }])

    if (error) {
      logger.error('agency_conversions insert error', { error: error.message })
    } else {
      logger.info(`Agency conversion recorded: agency=${visit.agency_id}, visit=${visit.id}`)
    }
  } catch (error) {
    logger.error('createAgencyConversion error', { error: error instanceof Error ? error.message : String(error) })
  }
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
      logger.info('Processing error screenshot for auto-recovery', { userId })

      try {
        // エラー修復システムを起動
        const recoveryManager = new RecoveryManager()

        // 画像をBase64として取得
        const imageBase64 = await imageHandler.getImageBase64(messageId)

        // 元のコードとセッションIDを取得
        const originalCode = (context as any).lastGeneratedCode || ''
        const sessionId = context.sessionId || generateSessionId()
        const attemptCount = (context as any).errorAttemptCount || 0

        // エラー修復プロセスを開始（RecoveryManagerが直接LINEにメッセージを送信）
        const result = await recoveryManager.startRecovery(
          userId,
          sessionId,
          originalCode,
          imageBase64,
          attemptCount
        )

        logger.info('Error recovery completed', {
          userId,
          success: result.success,
          shouldEscalate: result.shouldEscalate
        })

        // コンテキストを更新
        if (result.success && result.fixedCode) {
          // 成功: 修正後のコードを保存
          ; (context as any).lastGeneratedCode = result.fixedCode
            ; (context as any).errorAttemptCount = 0
            ; (context as any).lastRecoveryLogId = result.recoveryLogId
        } else if (!result.shouldEscalate) {
          // 失敗: 試行回数をインクリメント
          ; (context as any).errorAttemptCount = attemptCount + 1
            ; (context as any).lastRecoveryLogId = result.recoveryLogId
        }

        // waitingForScreenshotフラグをクリア
        delete (context as any).waitingForScreenshot

        // SessionManager経由で更新を保存
        await sessionManager.saveContext(userId, context)

        // エラー修復システムが既に返信済みなので、ここでは処理終了
        return true

      } catch (error) {
        logger.error('Error recovery system failed', {
          userId,
          error: error instanceof Error ? error.message : String(error)
        })

        // エラー時は通常のフローにフォールバック
        delete (context as any).waitingForScreenshot
        await sessionManager.saveContext(userId, context)

        // エラーメッセージを送信
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: '申し訳ございません。エラー分析中に問題が発生しました。\n\n「エンジニアに相談」ボタンから直接ご相談ください。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアに相談', text: 'エンジニアに相談する' } },
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' } },
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } }
            ]
          }
        }] as any)
        return true
      }
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
 * Netlifyへイベントを転送（非同期、バックグラウンド）
 * Render → Netlify転送により、代理店プログラムのコンバージョントラッキングを実現
 */
async function forwardToNetlify(body: string, signature: string, requestId: string): Promise<void> {
  const netlifyWebhookUrl = process.env.NETLIFY_WEBHOOK_URL

  if (!netlifyWebhookUrl) {
    logger.debug('NETLIFY_WEBHOOK_URL not configured, skipping forward', { requestId })
    return
  }

  try {
    logger.info('Forwarding to Netlify', { requestId, url: netlifyWebhookUrl })

    const response = await fetch(netlifyWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Line-Signature': signature,
        'X-Forwarded-From': 'render'  // 無限ループ防止フラグ
      },
      body: body,
      signal: AbortSignal.timeout(5000) // 5秒タイムアウト
    })

    if (!response.ok) {
      logger.warn('Netlify forward failed', {
        requestId,
        status: response.status,
        statusText: response.statusText
      })
    } else {
      logger.info('Netlify forward successful', {
        requestId,
        status: response.status
      })
    }
  } catch (error) {
    logger.error('Netlify forward error', {
      requestId,
      error: error instanceof Error ? error.message : String(error)
    })
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