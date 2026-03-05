/**
 * @requirements REQ-CONSULTATION-001
 * @description LINE Bot Haiku相談モードハンドラー
 *
 * AI診断結果後の詳細相談機能。Claudeの低コストモデル（Haiku）を使用して
 * ユーザーの業務課題を深掘りし、リード情報を収集・スコアリングする。
 */

import { ConversationContext } from '@/lib/conversation/conversational-flow'
import { logger } from '@/lib/utils/logger'

// ============================================================
// 定数定義
// ============================================================

const CONSULTATION_TRIGGERS = ['詳しく相談', '相談する', 'もっと詳しく', '詳しく相談する']
const CANCEL_TRIGGERS = ['キャンセル', 'メニュー', '最初から', '中断']
const MAX_CONSULTATION_MESSAGES = 10
const BOOKING_URL = 'https://timerex.net/s/cz1917903_47c5/7caf7949'

// ============================================================
// 型定義
// ============================================================

interface DiagnosisContext {
  industry: string
  challenge: string
  recommendations: Array<{
    systemName: string
    systemId: string
    estimatedTimeSaving: string
  }>
}

interface LeadData {
  userId: string
  sessionId: string
  name: string
  company: string
  industry: string
  revenue: string
  employees: string
  phone: string
  email: string
  challenges: string
  budget: string
  timeline: string
  messageCount: number
}

// ============================================================
// トリガー判定
// ============================================================

/**
 * 相談モード開始トリガーかどうか判定する
 */
export function isConsultationTrigger(text: string): boolean {
  return CONSULTATION_TRIGGERS.some((trigger) => text.includes(trigger))
}

// ============================================================
// Haiku API呼び出し
// ============================================================

/**
 * Claude Haiku APIを直接呼び出す
 */
async function callHaiku(
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  maxTokens: number = 512
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Haiku API error: ${response.status} ${errorBody}`)
  }

  const data = await response.json()
  const text = data?.content?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Haiku API returned unexpected response format')
  }
  return text
}

// ============================================================
// システムプロンプト生成
// ============================================================

/**
 * 診断結果を含む動的システムプロンプトを生成する
 */
function buildConsultationSystemPrompt(diagnosisContext: DiagnosisContext): string {
  const rec1 = diagnosisContext.recommendations[0]
  const rec2 = diagnosisContext.recommendations[1]
  const rec3 = diagnosisContext.recommendations[2]

  const recLines = [
    rec1 ? `1. ${rec1.systemName}（${rec1.estimatedTimeSaving}削減）` : '',
    rec2 ? `2. ${rec2.systemName}（${rec2.estimatedTimeSaving}削減）` : '',
    rec3 ? `3. ${rec3.systemName}（${rec3.estimatedTimeSaving}削減）` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return `あなたは株式会社イケメンのTaskMate業務自動化コンサルタントAIです。

【直前のAI診断結果】
業種: ${diagnosisContext.industry}
課題: ${diagnosisContext.challenge}
推薦システム:
${recLines}

【役割】
診断結果を踏まえ、ユーザーの具体的な業務課題を深掘りし、推薦システムの導入効果を説明します。

【ヒアリングフロー】
Phase 1（1-2往復）: 課題の具体化
- 「${diagnosisContext.industry}で${diagnosisContext.challenge}に課題をお持ちとのことですが、具体的にどのような作業に時間がかかっていますか？」
- 現在の方法（Excel？手作業？）を確認
- 何人で対応、月何時間かかるか確認

Phase 2（1-2往復）: お名前・会社名の取得
- 「具体的なROI試算をお出しできます。お名前とご所属を教えていただけますか？」

Phase 3（1-2往復）: 連絡先 + ROI提示
- 「詳細な試算レポートをメールでもお送りします。メールアドレスを教えていただけますか？」
- 推薦システムの具体的ROI（「${rec1 ? `${rec1.systemName}で${rec1.estimatedTimeSaving}削減` : ''}」等）

Phase 4（1往復）: CTA
- 「15分の無料相談で、実際に動いているデモをお見せできます」
- 予約リンク: ${BOOKING_URL}

【重要なルール】
- 1メッセージ180文字以内
- 1メッセージにつき1-2問まで
- 絵文字は使用禁止
- 診断結果の3システムに関連する具体例で説明
- 押し売りは絶対にしない、価値提供を優先
- 予約リンクはPhase 4で必ず送る
- 予約リンクの後は「ご検討ください」で自然にクローズ`
}

// ============================================================
// リード情報抽出
// ============================================================

/**
 * 会話履歴からリード情報をHaiku APIで抽出する
 * DX顧問_v2の _extractDataWithAI パターンをTypeScript化
 */
async function extractLeadData(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userId: string,
  sessionId: string
): Promise<LeadData> {
  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`)
    .join('\n')

  const extractionPrompt = `以下の会話からリード情報をJSON形式で抽出してください。
情報がない項目は空文字列にしてください。

【会話】
${conversationText}

【出力形式】
{
  "name": "名前（姓名）",
  "company": "会社名・組織名",
  "industry": "業種",
  "revenue": "年商・売上規模",
  "employees": "従業員数",
  "phone": "電話番号",
  "email": "メールアドレス",
  "challenges": "課題・悩みの要約",
  "budget": "予算感",
  "timeline": "導入検討時期"
}

JSONのみを返してください。説明文は不要です。`

  try {
    const responseText = await callHaiku(
      'あなたはデータ抽出の専門家です。会話からリード情報を正確に抽出します。',
      [{ role: 'user', content: extractionPrompt }],
      512
    )

    // JSONパース試行
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        userId,
        sessionId,
        name: parsed.name || '',
        company: parsed.company || '',
        industry: parsed.industry || '',
        revenue: parsed.revenue || '',
        employees: parsed.employees || '',
        phone: parsed.phone || '',
        email: parsed.email || '',
        challenges: parsed.challenges || '',
        budget: parsed.budget || '',
        timeline: parsed.timeline || '',
        messageCount: messages.length,
      }
    }
  } catch (error) {
    logger.warn('Haiku lead extraction failed, falling back to regex', { userId, error })
  }

  // フォールバック: 正規表現で抽出
  const fullText = conversationText
  return {
    userId,
    sessionId,
    name: fullText.match(/(?:名前|氏名|お名前)[はが：:は]?\s*([^\s、。\n]{2,20})/)?.[1] || '',
    company:
      fullText.match(/(?:会社名?|所属|組織)[はが：:は]?\s*([^\s、。\n]{2,30}(?:株式会社|有限会社|合同会社|LLC|Inc\.?)?)/)?.[1] || '',
    industry: '',
    revenue: '',
    employees: '',
    phone:
      fullText.match(/(\d{2,4}[-\s]?\d{3,4}[-\s]?\d{4})/)?.[1] || '',
    email:
      fullText.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)?.[1] || '',
    challenges: '',
    budget: '',
    timeline: '',
    messageCount: messages.length,
  }
}

// ============================================================
// リードスコアリング
// DX顧問_v2の calculateLeadScore ロジックを転用
// ============================================================

function calculateLeadScore(leadData: LeadData): { score: number; rank: string } {
  let score = 0

  // 基本情報の充足度
  if (leadData.name) score += 20
  if (leadData.company) score += 25
  if (leadData.email) score += 20
  if (leadData.phone) score += 15

  // 予算・タイムライン情報
  if (leadData.budget) score += 10
  if (leadData.timeline) score += 5

  // 課題の具体性
  if (leadData.challenges && leadData.challenges.length > 20) score += 5

  // ランク判定
  let rank: string
  if (score >= 80) {
    rank = 'S'
  } else if (score >= 60) {
    rank = 'A'
  } else if (score >= 40) {
    rank = 'B'
  } else {
    rank = 'C'
  }

  return { score, rank }
}

// ============================================================
// Supabase リード保存
// ============================================================

async function saveConsultationLead(
  leadData: LeadData,
  diagnosisContext: DiagnosisContext,
  score: number,
  rank: string,
  conversationLog: string,
  notifiedAt: Date | null
): Promise<void> {
  try {
    const { supabaseAdmin } = await import('@/lib/supabase/client')
    const { error } = await supabaseAdmin.from('consultation_leads').upsert(
      {
        line_user_id: leadData.userId,
        session_id: leadData.sessionId,
        status: leadData.company ? 'ヒアリング中' : '新規',
        lead_score: score,
        lead_rank: rank,
        name: leadData.name,
        company: leadData.company,
        industry: leadData.industry || diagnosisContext.industry,
        revenue: leadData.revenue,
        employees: leadData.employees,
        phone: leadData.phone,
        email: leadData.email,
        challenges: leadData.challenges,
        recommended_systems: diagnosisContext.recommendations,
        budget: leadData.budget,
        timeline: leadData.timeline,
        message_count: leadData.messageCount,
        conversation_log: conversationLog,
        notified_at: notifiedAt?.toISOString() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id' }
    )

    if (error) {
      logger.error('Failed to save consultation lead', { userId: leadData.userId, error })
    } else {
      logger.info('Consultation lead saved', {
        userId: leadData.userId,
        sessionId: leadData.sessionId,
        rank,
        score,
      })
    }
  } catch (error) {
    logger.error('saveConsultationLead threw', { userId: leadData.userId, error })
  }
}

// ============================================================
// 管理者通知
// ============================================================

async function notifyAdmin(
  userId: string,
  leadData: LeadData,
  rank: string,
  lineClient: any
): Promise<void> {
  try {
    const supportGroupId = process.env.ENGINEER_SUPPORT_GROUP_ID || ''
    const engineerUserIds = (process.env.ENGINEER_USER_IDS || '')
      .split(',')
      .filter((id) => id.trim())

    const notificationText = `[相談リード通知]

ランク: ${rank}
会社名: ${leadData.company || '未取得'}
担当者: ${leadData.name || '未取得'}
業種: ${leadData.industry || '未取得'}
課題: ${leadData.challenges || '未取得'}
メール: ${leadData.email || '未取得'}
電話: ${leadData.phone || '未取得'}
LINE ID: ${userId}
メッセージ数: ${leadData.messageCount}`

    const notificationMessage = [{ type: 'text', text: notificationText }]

    if (supportGroupId) {
      await lineClient.pushMessage(supportGroupId, notificationMessage)
    }

    if (engineerUserIds.length > 0 && (rank === 'S' || rank === 'A')) {
      await Promise.all(
        engineerUserIds.map((engineerId) =>
          lineClient.pushMessage(engineerId, notificationMessage)
        )
      )
    }

    logger.info('Admin notified about consultation lead', { userId, rank })
  } catch (error) {
    logger.error('Failed to notify admin', { userId, error })
  }
}

// ============================================================
// メインハンドラー
// ============================================================

/**
 * 相談モードの処理を行うメインハンドラー
 *
 * @returns handled - true の場合、後続ハンドラーをスキップする
 */
export async function handleConsultation(
  userId: string,
  messageText: string,
  replyToken: string,
  context: ConversationContext | null,
  sessionManager: any,
  lineClient: any
): Promise<boolean> {

  // ============================================================
  // キャンセル処理（相談モード中のみ）
  // ============================================================
  if (context?.consultationMode && CANCEL_TRIGGERS.includes(messageText)) {
    const updated = {
      ...context,
      consultationMode: false,
      consultationMessages: undefined,
      consultationDiagnosisContext: undefined,
      consultationNotified: undefined,
    }
    await sessionManager.saveContext(userId, updated)

    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: '相談を終了しました。またいつでもご相談ください。',
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
          ],
        },
      },
    ])
    return true
  }

  // ============================================================
  // トリガー検出 → 相談モード開始
  // ============================================================
  if (!context?.consultationMode && isConsultationTrigger(messageText)) {
    // 診断コンテキストがない場合は診断を案内
    if (!context?.consultationDiagnosisContext) {
      await lineClient.replyMessage(replyToken, [
        {
          type: 'text',
          text: 'まずAI診断を受けていただくと、診断結果に基づいた詳しいご相談ができます。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '🔍 AI診断を受ける', text: 'AI診断' } },
              { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
            ],
          },
        },
      ])
      return true
    }

    // 相談モード開始
    let diagnosisContext: DiagnosisContext
    try {
      diagnosisContext = JSON.parse(context.consultationDiagnosisContext) as DiagnosisContext
    } catch {
      logger.error('Failed to parse consultationDiagnosisContext', { userId })
      await lineClient.replyMessage(replyToken, [
        {
          type: 'text',
          text: '診断データの読み込みに失敗しました。もう一度AI診断をお試しください。',
          quickReply: {
            items: [
              { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
            ],
          },
        },
      ])
      return true
    }

    const systemPrompt = buildConsultationSystemPrompt(diagnosisContext)
    const initialMessage = await callHaiku(
      systemPrompt,
      [{ role: 'user', content: '相談したいです。' }],
      512
    ).catch((err) => {
      logger.error('Haiku initial message failed', { userId, err })
      return `${diagnosisContext.industry}での${diagnosisContext.challenge}について、具体的にどのような作業に時間がかかっていますか？`
    })

    const updated = {
      ...context,
      consultationMode: true,
      consultationMessages: [
        { role: 'user' as const, content: '相談したいです。' },
        { role: 'assistant' as const, content: initialMessage },
      ],
      consultationNotified: false,
    }
    await sessionManager.saveContext(userId, updated)

    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: initialMessage,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '❌ 相談をやめる', text: 'キャンセル' } },
          ],
        },
      },
    ])
    return true
  }

  // ============================================================
  // 相談モード中のメッセージ処理
  // ============================================================
  if (!context?.consultationMode) return false

  const currentMessages = context.consultationMessages || []
  const messageCount = currentMessages.length

  // メッセージ上限チェック
  if (messageCount >= MAX_CONSULTATION_MESSAGES * 2) {
    const updated = {
      ...context,
      consultationMode: false,
      consultationMessages: undefined,
    }
    await sessionManager.saveContext(userId, updated)

    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: `ご質問ありがとうございました。詳しいご提案は15分の無料相談でお伝えします。\n\n予約はこちら: ${BOOKING_URL}\n\nご検討ください。`,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'uri', label: '📅 無料相談を予約', uri: BOOKING_URL } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
          ],
        },
      },
    ])
    return true
  }

  // 診断コンテキスト取得
  let diagnosisContext: DiagnosisContext = {
    industry: '',
    challenge: '',
    recommendations: [],
  }
  if (context.consultationDiagnosisContext) {
    try {
      diagnosisContext = JSON.parse(context.consultationDiagnosisContext) as DiagnosisContext
    } catch {
      logger.warn('Failed to parse consultationDiagnosisContext in conversation', { userId })
    }
  }

  // 会話履歴にユーザーメッセージを追加
  const updatedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...currentMessages,
    { role: 'user', content: messageText },
  ]

  // Haiku API呼び出し
  const systemPrompt = buildConsultationSystemPrompt(diagnosisContext)
  let aiReply: string
  try {
    aiReply = await callHaiku(systemPrompt, updatedMessages, 512)
  } catch (error) {
    logger.error('Haiku API failed during consultation', { userId, error })
    aiReply = '申し訳ありません。一時的なエラーが発生しました。もう一度メッセージをお送りください。'
  }

  // 応答を会話履歴に追加
  const finalMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    ...updatedMessages,
    { role: 'assistant', content: aiReply },
  ]

  // 予約リンクが含まれているか判定（相談終了フラグ）
  const isEndingConversation = aiReply.includes(BOOKING_URL)

  // リード情報抽出（Haiku API, 512tokens）
  const sessionId = context.sessionId || `${userId}_${Date.now()}`
  const leadData = await extractLeadData(finalMessages, userId, sessionId)

  // スコアリング
  const { score, rank } = calculateLeadScore(leadData)

  // 管理者通知 - 会社名が取得できた かつ 未通知の場合
  let notified = context.consultationNotified || false
  if (leadData.company && !notified) {
    await notifyAdmin(userId, leadData, rank, lineClient)
    notified = true
  }

  // Supabase保存（非同期、エラーでも応答はブロックしない）
  const conversationLog = finalMessages
    .map((m) => `${m.role === 'user' ? 'ユーザー' : 'AI'}: ${m.content}`)
    .join('\n---\n')

  saveConsultationLead(
    leadData,
    diagnosisContext,
    score,
    rank,
    conversationLog,
    notified ? new Date() : null
  ).catch((err) => {
    logger.error('Background saveConsultationLead failed', { userId, err })
  })

  // セッション更新
  const updatedContext = {
    ...context,
    consultationMode: isEndingConversation ? false : true,
    consultationMessages: isEndingConversation ? undefined : finalMessages,
    consultationNotified: notified,
    sessionId,
  }
  await sessionManager.saveContext(userId, updatedContext)

  // ユーザーへの返信
  if (isEndingConversation) {
    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: aiReply,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'uri', label: '📅 無料相談を予約', uri: BOOKING_URL } },
            { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
            { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
          ],
        },
      },
    ])
  } else {
    await lineClient.replyMessage(replyToken, [
      {
        type: 'text',
        text: aiReply,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '❌ 相談をやめる', text: 'キャンセル' } },
          ],
        },
      },
    ])
  }

  return true
}
