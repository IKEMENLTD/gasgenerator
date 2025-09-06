import { NextRequest, NextResponse } from 'next/server'
import { LineWebhookValidator, recentEventCache } from '../../../lib/line/webhook-validator'
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

export async function POST(req: NextRequest) {
  const requestId = generateRequestId()
  
  try {
    // リクエストボディ取得
    const body = await req.text()
    const signature = req.headers.get('x-line-signature')

    // Webhook検証
    const validation = await LineWebhookValidator.validate(body, signature, requestId)
    if (!validation.isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 200 })
    }

    // 各イベントを処理
    for (const event of validation.events) {
      if (event.type !== 'message' || event.message?.type !== 'text') {
        continue
      }

      // 重複チェック
      const eventKey = `${event.source.userId}_${event.timestamp}`
      if (recentEventCache.has(eventKey)) {
        continue
      }
      recentEventCache.set(eventKey, true)
      setTimeout(() => recentEventCache.delete(eventKey), 30000)

      // メッセージ処理
      await processMessage(event, requestId)
    }

    return NextResponse.json({ success: true }, { status: 200 })

  } catch (error) {
    logger.error('Webhook error', { requestId, error })
    return NextResponse.json({ success: false }, { status: 200 })
  }
}

async function processMessage(event: LineWebhookEvent, requestId: string) {
  const userId = event.source.userId
  const messageText = event.message?.text?.trim() || ''
  const replyToken = event.replyToken!

  logger.info('Processing message', { userId, messageText })

  try {
    // 会話コンテキストを取得（タイムアウト管理付き）
    let context = sessionStore.get(userId)

    // リセットコマンド
    if (messageText === 'リセット' || messageText === '最初から' || messageText === '新しいコードを作りたい') {
      sessionStore.delete(userId)
      context = undefined
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

  } catch (error) {
    logger.error('Message processing error', { userId, error })
    
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '申し訳ございません。エラーが発生しました。\n「最初から」と入力してやり直してください。'
    }])
    
    // エラー時はコンテキストをクリア
    sessionStore.delete(userId)
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    service: 'GAS Generator Conversational Webhook',
    mode: 'conversational',
    timestamp: new Date().toISOString()
  })
}