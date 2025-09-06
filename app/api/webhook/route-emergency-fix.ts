import { NextRequest, NextResponse } from 'next/server'
import { LineWebhookValidator } from '../../../lib/line/webhook-validator'
import { LineApiClient } from '../../../lib/line/client'
import { MessageTemplates } from '../../../lib/line/message-templates'
import { QueueManager } from '../../../lib/queue/manager'
import { logger } from '../../../lib/utils/logger'
import { generateRequestId } from '../../../lib/utils/crypto'
import { getCategoryIdByName } from '../../../lib/conversation/category-definitions'
import { ConversationalFlow, ConversationContext } from '../../../lib/conversation/conversational-flow'
import { ConversationSessionStore } from '../../../lib/conversation/session-store'
import type { LineWebhookEvent } from '../../../types/line'

// エッジランタイム使用
export const runtime = 'edge'
export const maxDuration = 10

const lineClient = new LineApiClient()

// 会話セッションストア（永続化＆タイムアウト管理）
const sessionStore = ConversationSessionStore.getInstance()

// 重複イベント検出用の簡易キャッシュ
const recentEventKeys = new Set<string>()

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // リクエストボディ取得
    const body = await req.text()
    const signature = req.headers.get('x-line-signature')

    logger.info('Webhook received', { requestId, bodyLength: body.length })

    // Webhook検証（簡略化）
    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 200 })
    }

    // bodyをパース
    let parsedBody: any
    try {
      parsedBody = JSON.parse(body)
    } catch (e) {
      logger.error('Invalid JSON body', { requestId })
      return NextResponse.json({ error: 'Invalid body' }, { status: 200 })
    }

    // イベント処理
    const events = parsedBody.events || []
    
    for (const event of events) {
      try {
        // follow/unfollowイベントは無視
        if (event.type === 'follow' || event.type === 'unfollow') {
          logger.info('Skipping non-message event', { type: event.type })
          continue
        }

        // メッセージイベント以外は無視
        if (event.type !== 'message' || event.message?.type !== 'text') {
          continue
        }

        // 重複チェック（簡易版）
        const eventKey = `${event.source?.userId}_${event.timestamp}`
        if (recentEventKeys.has(eventKey)) {
          logger.info('Duplicate event detected', { eventKey })
          continue
        }
        
        // キャッシュに追加（30秒後に削除）
        recentEventKeys.add(eventKey)
        setTimeout(() => recentEventKeys.delete(eventKey), 30000)
        
        // サイズ制限（1000件まで）
        if (recentEventKeys.size > 1000) {
          const firstKey = recentEventKeys.values().next().value
          recentEventKeys.delete(firstKey)
        }

        // メッセージ処理
        await processMessage(event as LineWebhookEvent, requestId)
        
      } catch (eventError) {
        logger.error('Event processing error', { 
          requestId,
          eventType: event.type,
          error: eventError instanceof Error ? eventError.message : String(eventError)
        })
      }
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error) {
    logger.error('Webhook error', { 
      requestId, 
      error: error instanceof Error ? error.message : String(error)
    })
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

async function processMessage(event: LineWebhookEvent, requestId: string) {
  const userId = event.source?.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken
  
  if (!userId || !replyToken) {
    logger.warn('Missing userId or replyToken', { event })
    return
  }

  logger.info('Processing message', { userId, messageText })

  try {
    // 会話コンテキストを取得（タイムアウト管理付き）
    let context = sessionStore.get(userId)

    // リセットコマンド
    if (messageText === 'リセット' || messageText === '最初から' || messageText === '新しいコードを作りたい') {
      sessionStore.delete(userId)
      context = null
    }

    // コンテキストがない場合は新規開始
    if (!context) {
      // カテゴリ選択
      const categoryId = getCategoryIdByName(messageText)
      
      if (!categoryId) {
        // カテゴリ選択を促す
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
        return
      }

      // 新しい会話コンテキストを作成
      context = ConversationalFlow.resetConversation(categoryId)
      sessionStore.set(userId, context)
    }

    // コード生成確認段階
    if (context.readyForCode) {
      if (messageText === 'はい' || messageText.toLowerCase() === 'ok' || messageText === '生成') {
        // コード生成をキューに追加
        try {
          await QueueManager.addJob({
            userId,
            lineUserId: userId,
            sessionId: `conv_${Date.now()}`,
            category: context.category,
            subcategory: 'conversational',
            requirements: {
              conversation: context.messages,
              extractedRequirements: context.requirements,
              prompt: ConversationalFlow.generateCodePrompt(context)
            }
          })

          await lineClient.replyMessage(replyToken, [{
            type: 'text',
            text: '🚀 承知しました！\n\nコードを生成中です...\n1-2分ほどお待ちください。\n\n生成が完了したらお知らせします！'
          }])
        } catch (queueError) {
          logger.error('Queue error', { queueError })
          await lineClient.replyMessage(replyToken, [{
            type: 'text',
            text: '申し訳ございません。システムエラーが発生しました。\nもう一度お試しください。'
          }])
        }

        // コンテキストをリセット
        sessionStore.delete(userId)
        return
        
      } else if (messageText === '修正' || messageText === 'やり直し') {
        // 要件収集を続ける
        context.readyForCode = false
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: 'どの部分を修正したいですか？詳しく教えてください。'
        }])
        sessionStore.set(userId, context)
        return
      }
    }

    // 会話的な要件収集
    try {
      const result = await ConversationalFlow.processConversation(context, messageText)
      
      // コンテキストを更新
      sessionStore.set(userId, result.updatedContext)

      // 返信を送信
      if (result.isComplete) {
        // 要件収集完了 - 確認メッセージ付き
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: result.reply,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '✅ はい', text: 'はい' }},
              { type: 'action', action: { type: 'message', label: '✏️ 修正', text: '修正' }},
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }}
            ]
          }
        }])
      } else {
        // 会話を続ける
        await lineClient.replyMessage(replyToken, [{
          type: 'text',
          text: result.reply,
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }}
            ]
          }
        }])
      }
    } catch (conversationError) {
      logger.error('Conversation error', { conversationError })
      
      // フォールバック：シンプルな返信
      await lineClient.replyMessage(replyToken, [{
        type: 'text',
        text: 'もう少し詳しく教えていただけますか？\n\nどのような処理を自動化したいですか？'
      }])
    }

  } catch (error) {
    logger.error('Message processing error', { userId, error })
    
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
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    service: 'GAS Generator Conversational Webhook',
    mode: 'conversational-emergency-fix',
    version: '1.0.1',
    timestamp: new Date().toISOString()
  })
}