/**
 * LINE Bot AI診断ハンドラー
 *
 * 5つの質問にQuick Replyで回答 → Claude APIで3システム推薦
 */

import { ConversationContext } from '@/lib/conversation/conversational-flow'
import { AIProviderManager } from '@/lib/ai/provider'
import {
  generateRecommendationPrompt,
  parseRecommendationResponse,
} from '@/lib/ai/recommendation-prompt'
import { getSystemsData } from '@/lib/data/systems-data'
import { generateUrlSignature } from '@/lib/utils/crypto'
import { logger } from '@/lib/utils/logger'

// 5つの質問定義
const QUESTIONS = [
  {
    id: 1,
    text: '御社の業種を選択してください',
    options: ['小売業', '飲食業', 'サービス業', '士業（税理士・社労士等）', '建設業', 'EC/通販', 'BtoB企業', 'IT企業', 'その他'],
  },
  {
    id: 2,
    text: '最も課題を感じている業務は何ですか？',
    options: ['在庫管理', '顧客管理', '期限管理', '経費精算', 'シフト管理', '請求書作成', '売上分析', '工数管理', 'その他'],
  },
  {
    id: 3,
    text: '月間のお客様の数はどのくらいですか？',
    options: ['0〜50', '50〜200', '200〜500', '500以上'],
  },
  {
    id: 4,
    text: '月に何時間削減したいですか？',
    options: ['10時間', '20時間', '40時間', '80時間以上'],
  },
  {
    id: 5,
    text: '予算感はどのくらいですか？',
    options: ['月額1万円', '月額3万円', '月額5万円', '月額10万円以上'],
  },
]

/** トリガーテキスト判定 */
export function isDiagnosisTrigger(text: string): boolean {
  const triggers = ['AI診断', 'ai診断', 'AIシステム診断', 'AI相談', 'ai相談', '診断']
  return triggers.includes(text)
}

/** 質問の有効な回答かどうか判定 */
function isValidAnswer(text: string, step: number): boolean {
  const q = QUESTIONS[step - 1]
  if (!q) return false
  return q.options.includes(text)
}

/** Quick Replyアイテム生成 */
function buildQuickReplyItems(step: number) {
  const q = QUESTIONS[step - 1]
  const items: any[] = q.options.map((opt) => ({
    type: 'action',
    action: { type: 'message', label: opt.slice(0, 20), text: opt },
  }))
  // キャンセルボタン追加
  items.push({
    type: 'action',
    action: { type: 'message', label: '❌ キャンセル', text: 'キャンセル' },
  })
  return items
}

/** 推薦結果のFlexカルーセル生成 */
function buildResultCarousel(recommendations: Array<{
  systemId: string
  systemName: string
  priority: number
  reason: string
  estimatedTimeSaving: string
}>, systemsData: Array<{ id: string; name: string }>, catalogAuthParams: string) {
  const headerColors = ['#059669', '#0ea5e9', '#8b5cf6']

  const bubbles = recommendations.map((rec, i) => {
    // Claude APIの返答名ではなく、正式なシステム名をダウンロードボタンに使用
    const exactSystem = systemsData.find((s) => s.id === rec.systemId || s.id === String(rec.systemId).padStart(2, '0'))
    const exactName = exactSystem ? exactSystem.name : rec.systemName

    return ({
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: `#${rec.priority}`, weight: 'bold', size: 'lg', color: '#ffffff', flex: 0 },
            { type: 'text', text: rec.systemName, weight: 'bold', size: 'md', color: '#ffffff', flex: 1, margin: 'md', wrap: true },
          ],
        },
        { type: 'text', text: `${rec.estimatedTimeSaving}削減`, size: 'xs', color: '#ffffff', margin: 'sm' },
      ],
      backgroundColor: headerColors[i] || '#06b6d4',
      paddingAll: '15px',
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        { type: 'text', text: rec.reason, size: 'sm', color: '#555555', wrap: true },
      ],
      paddingAll: '15px',
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: 'カタログで見る',
            uri: `https://gasgenerator.onrender.com/systems/catalog?id=${rec.systemId}&${catalogAuthParams}`,
          },
          style: 'primary',
          color: headerColors[i] || '#06b6d4',
          height: 'sm',
        },
        {
          type: 'button',
          action: {
            type: 'message',
            label: 'ダウンロード',
            text: `${exactName}をダウンロード`,
          },
          style: 'secondary',
          margin: 'sm',
          height: 'sm',
        },
      ],
      paddingAll: '12px',
    },
  })
  })

  return {
    type: 'flex',
    altText: 'AI診断結果: おすすめシステム3選',
    contents: { type: 'carousel', contents: bubbles },
  }
}

/** メインの診断ハンドラー */
export async function handleDiagnosis(
  userId: string,
  messageText: string,
  replyToken: string,
  context: ConversationContext | null,
  sessionManager: any,
  lineClient: any
): Promise<boolean> {

  // キャンセル処理
  if (context?.diagnosisMode && (messageText === 'キャンセル' || messageText === '最初から')) {
    const updated = { ...context, diagnosisMode: false, diagnosisStep: undefined, diagnosisAnswers: undefined }
    await sessionManager.saveContext(userId, updated)
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: 'AI診断をキャンセルしました。',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
          { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
          { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
        ],
      },
    }])
    return true
  }

  // トリガー: 診断開始
  if (isDiagnosisTrigger(messageText)) {
    const diagnosisContext: any = {
      ...(context || { category: '', messages: [], requirements: {}, readyForCode: false }),
      userId,
      diagnosisMode: true,
      diagnosisStep: 1,
      diagnosisAnswers: [],
    }
    await sessionManager.saveContext(userId, diagnosisContext)

    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '🔍 AIシステム診断を開始します！\n\n5つの質問に答えるだけで、あなたの業務に最適なシステムを3つご提案します。\n\nQ1. ' + QUESTIONS[0].text,
      quickReply: { items: buildQuickReplyItems(1) },
    }])
    return true
  }

  // diagnosisMode でない場合はスルー
  if (!context?.diagnosisMode) return false

  const currentStep = context.diagnosisStep || 1

  // 回答バリデーション
  if (!isValidAnswer(messageText, currentStep)) {
    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '下のボタンから選択してください。\n\nQ' + currentStep + '. ' + QUESTIONS[currentStep - 1].text,
      quickReply: { items: buildQuickReplyItems(currentStep) },
    }])
    return true
  }

  // 回答を蓄積
  const answers = [...(context.diagnosisAnswers || []), { questionId: currentStep, answer: messageText }]

  // まだ5問完了していない → 次の質問
  if (currentStep < 5) {
    const nextStep = currentStep + 1
    const updated = { ...context, diagnosisStep: nextStep, diagnosisAnswers: answers }
    await sessionManager.saveContext(userId, updated)

    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: `Q${nextStep}. ${QUESTIONS[nextStep - 1].text}`,
      quickReply: { items: buildQuickReplyItems(nextStep) },
    }])
    return true
  }

  // 5問完了 → Claude APIで推薦生成
  const updated = { ...context, diagnosisAnswers: answers }
  await sessionManager.saveContext(userId, updated)

  // ローディング表示
  lineClient.showLoadingAnimation(userId, 60).catch(() => {})

  try {
    // 回答データを整形
    const userAnswers = {
      industry: answers.find((a) => a.questionId === 1)?.answer || '',
      challenge: answers.find((a) => a.questionId === 2)?.answer || '',
      customerCount: answers.find((a) => a.questionId === 3)?.answer || '',
      timeSavingGoal: answers.find((a) => a.questionId === 4)?.answer || '',
      budget: answers.find((a) => a.questionId === 5)?.answer || '',
    }

    // システムデータ取得 & プロンプト生成
    const systems = getSystemsData()
    const prompt = generateRecommendationPrompt(systems, userAnswers)

    logger.info('LINE diagnosis: calling Claude API', { userId, userAnswers })

    // Claude API呼び出し
    const aiProvider = AIProviderManager.getInstance()
    const response = await aiProvider.sendMessage(
      [{ role: 'user', content: prompt }],
      userId,
      3,
      2000
    )

    // レスポンスからテキスト取得
    let responseText: string
    if (Array.isArray(response.content)) {
      responseText = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')
    } else if (typeof response.content === 'string') {
      responseText = response.content
    } else {
      responseText = JSON.stringify(response)
    }

    // レスポンス解析
    const recommendation = parseRecommendationResponse(responseText)

    if (!recommendation || !recommendation.recommendations?.length) {
      throw new Error('推薦結果の解析に失敗しました')
    }

    logger.info('LINE diagnosis: recommendation generated', {
      userId,
      systemIds: recommendation.recommendations.map((r) => r.systemId),
    })

    // 署名付きカタログURLパラメータ生成
    const encodedUserId = btoa(userId)
    const timestamp = Date.now().toString()
    const sig = await generateUrlSignature(`${encodedUserId}:${timestamp}`)
    const catalogAuthParams = `u=${encodeURIComponent(encodedUserId)}&t=${timestamp}&s=${sig}`

    // 結果をFlexカルーセルで送信
    const carouselMessage = buildResultCarousel(recommendation.recommendations, systems, catalogAuthParams)
    const analysisMessage = {
      type: 'text',
      text: `📊 診断結果\n\n${recommendation.analysisText || '上記3つのシステムがあなたの業務に最適です。'}`,
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '📦 システム一覧', text: 'システム一覧' } },
          { type: 'action', action: { type: 'message', label: '🔍 もう一度診断', text: 'AI診断' } },
          { type: 'action', action: { type: 'message', label: '🚀 コード生成開始', text: 'コード生成を開始' } },
          { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
        ],
      },
    }

    await lineClient.replyMessage(replyToken, [carouselMessage, analysisMessage])

  } catch (error) {
    logger.error('LINE diagnosis error', { userId, error })

    await lineClient.replyMessage(replyToken, [{
      type: 'text',
      text: '申し訳ありません。診断中にエラーが発生しました。もう一度お試しください。',
      quickReply: {
        items: [
          { type: 'action', action: { type: 'message', label: '🔍 AI診断', text: 'AI診断' } },
          { type: 'action', action: { type: 'message', label: '📋 メニュー', text: 'メニュー' } },
        ],
      },
    }])
  }

  // 診断モード解除
  const cleared = { ...context, diagnosisMode: false, diagnosisStep: undefined, diagnosisAnswers: undefined }
  await sessionManager.saveContext(userId, cleared)

  return true
}
