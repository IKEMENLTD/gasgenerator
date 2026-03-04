/**
 * @requirements REQ-LP-CHAT-001
 * @description LP相談チャットAPI - AI診断結果を引き継いでHaikuで相談対応
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// メッセージ型定義
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// 診断コンテキスト型定義
interface DiagnosisContext {
  industry?: string
  challenge?: string
  recommendations?: Array<{
    systemName: string
    estimatedTimeSaving: string
    systemId?: string
    priority?: string
    reason?: string
  }>
}

// リクエストボディ型定義
interface ConsultationRequest {
  sessionId: string
  message: string
  diagnosisContext?: DiagnosisContext
  messages?: ChatMessage[]
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ConsultationRequest
    const { sessionId, message, diagnosisContext, messages } = body

    if (!sessionId || !message) {
      return NextResponse.json(
        { success: false, error: 'sessionId and message required' },
        { status: 400, headers: corsHeaders }
      )
    }

    // メッセージ長バリデーション
    if (message.length > 500) {
      return NextResponse.json(
        { success: false, error: 'Message too long (max 500 characters)' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 会話履歴の長さ制限（最大10往復=20メッセージ）
    const MAX_HISTORY = 20
    const trimmedMessages = (messages || []).slice(-MAX_HISTORY)

    const bookingUrl = process.env.CONSULTATION_BOOKING_URL || 'https://timerex.net/s/cz1917903_47c5/7caf7949'

    // システムプロンプト生成
    const systemPrompt = buildWebConsultationPrompt(diagnosisContext, bookingUrl)

    // 会話履歴を構築
    const apiMessages: ChatMessage[] = [
      ...trimmedMessages,
      { role: 'user', content: message }
    ]

    // Haiku API呼び出し
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not set')
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages: apiMessages
      }),
      signal: AbortSignal.timeout(30000)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Haiku API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json() as { content: Array<{ text: string }> }
    const reply = data.content[0].text

    logger.info('Consultation chat response', { sessionId, replyLength: reply.length })

    return NextResponse.json(
      { success: true, reply, sessionId },
      { headers: corsHeaders }
    )

  } catch (error) {
    logger.error('Consultation chat error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

function buildWebConsultationPrompt(diagnosisContext: DiagnosisContext | undefined, bookingUrl: string): string {
  const industry = diagnosisContext?.industry || '不明'
  const challenge = diagnosisContext?.challenge || '不明'
  const recs = diagnosisContext?.recommendations || []

  const recsText = recs.length > 0
    ? recs.map((r, i) => `${i + 1}. ${r.systemName}（${r.estimatedTimeSaving}削減）`).join('\n')
    : '（推薦結果なし）'

  return `あなたは株式会社イケメンのTaskMate業務自動化コンサルタントAIです。

【直前のAI診断結果】
業種: ${industry}
課題: ${challenge}
推薦システム:
${recsText}

【役割】
診断結果を踏まえ、ユーザーの業務課題を深掘りし、推薦システムの導入効果を具体的に説明します。
自然な会話で、お名前・会社名・連絡先を取得してください。

【ヒアリングフロー】
Phase 1（1-2往復）: 課題の具体化
- 具体的にどんな作業に時間がかかっているか
- 現在の方法（Excel、手作業等）

Phase 2（1-2往復）: お名前・会社名
- 「具体的なROI試算をお出しできます。お名前とご所属を教えていただけますか？」

Phase 3（1-2往復）: 連絡先 + ROI提示
- メールアドレスの取得
- 推薦システムのROI具体例

Phase 4（1往復）: CTA
- 「15分の無料相談で、実際に動いているデモをお見せできます」
- 予約リンク: ${bookingUrl}

【重要ルール】
- 1メッセージ180文字以内
- 1メッセージにつき1-2問まで
- 絵文字は使用禁止
- 押し売り禁止、価値提供優先
- 最初のメッセージでは「開始」というテキストを受け取るので、Phase 1の最初の質問をしてください`
}
