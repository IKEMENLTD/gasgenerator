/**
 * AI相談機能（システム推薦）API
 *
 * GET  /api/system-recommendation - 5つの質問を取得
 * POST /api/system-recommendation - ユーザー回答を元にClaude APIで推薦分析
 *
 * 2026-02-16: 初版作成
 */

import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { logger } from '@/lib/utils/logger'
import { AIProviderManager } from '@/lib/ai/provider'
import {
  generateRecommendationPrompt,
  parseRecommendationResponse,
} from '@/lib/ai/recommendation-prompt'
import { getSystemsData } from '@/lib/data/systems-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// CORSヘッダー設定
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://taskmateai.net',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

// OPTIONSリクエスト（プリフライト）対応
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  })
}

// 5つの質問定義
interface Question {
  id: number
  text: string
  options: string[]
}

const QUESTIONS: Question[] = [
  {
    id: 1,
    text: '御社の業種を選択してください',
    options: [
      '小売業',
      '飲食業',
      'サービス業',
      '士業（税理士・社労士等）',
      '建設業',
      'EC/通販',
      'BtoB企業',
      'IT企業',
      'その他',
    ],
  },
  {
    id: 2,
    text: '最も課題を感じている業務は何ですか？',
    options: [
      '在庫管理',
      '顧客管理',
      '期限管理',
      '経費精算',
      'シフト管理',
      '請求書作成',
      '売上分析',
      '工数管理',
      'その他',
    ],
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

/**
 * GET /api/system-recommendation
 * 5つの質問を返す
 */
export async function GET(request: NextRequest) {
  try {
    // セッションID生成
    const sessionId = nanoid()

    logger.info('System recommendation questions fetched', { sessionId })

    return NextResponse.json(
      {
        success: true,
        sessionId,
        questions: QUESTIONS,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    logger.error('Failed to fetch recommendation questions', { error })
    return NextResponse.json(
      { success: false, error: 'Failed to fetch questions' },
      { status: 500, headers: corsHeaders }
    )
  }
}

/**
 * POST /api/system-recommendation
 * ユーザーの回答を元にClaude APIで推薦分析
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sessionId, answers } = body

    // バリデーション
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'sessionId is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    if (!Array.isArray(answers) || answers.length !== 5) {
      return NextResponse.json(
        { success: false, error: 'answers must be an array of 5 items' },
        { status: 400, headers: corsHeaders }
      )
    }

    // 回答データを整形
    const userAnswers = {
      industry: answers.find((a: any) => a.questionId === 1)?.answer || '',
      challenge: answers.find((a: any) => a.questionId === 2)?.answer || '',
      customerCount: answers.find((a: any) => a.questionId === 3)?.answer || '',
      timeSavingGoal: answers.find((a: any) => a.questionId === 4)?.answer || '',
      budget: answers.find((a: any) => a.questionId === 5)?.answer || '',
    }

    logger.info('System recommendation request', {
      sessionId,
      userAnswers,
    })

    // システムデータを取得（lib/data/systems-data.ts から）
    const systems = getSystemsData()

    // Claude API用プロンプト生成
    const prompt = generateRecommendationPrompt(systems, userAnswers)

    logger.info('Generated recommendation prompt', {
      sessionId,
      promptLength: prompt.length,
    })

    // Claude APIで推薦分析（AIProviderManager使用）
    const aiProvider = AIProviderManager.getInstance()
    const response = await aiProvider.sendMessage(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      undefined, // userId
      3, // maxRetries
      2000 // customMaxTokens
    )

    // DEBUG: レスポンスオブジェクトの構造を確認
    logger.info('DEBUG: Response object', {
      sessionId,
      responseKeys: Object.keys(response),
      hasText: 'text' in response,
      hasContent: 'content' in response,
      contentType: response.content ? typeof response.content : 'undefined',
      contentIsArray: Array.isArray(response.content),
    })

    // レスポンスからテキストを取得
    let responseText: string
    if (Array.isArray(response.content)) {
      // content が配列の場合（Anthropic形式）
      responseText = response.content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n')
    } else if (typeof response.content === 'string') {
      responseText = response.content
    } else {
      responseText = JSON.stringify(response)
    }

    logger.info('Claude API response received', {
      sessionId,
      provider: response.provider,
      responseLength: responseText.length,
    })

    // DEBUG: Claudeの生レスポンスを出力（最初の500文字）
    logger.info('DEBUG: Claude raw response (first 500 chars)', {
      sessionId,
      responseText: responseText.substring(0, 500),
    })

    // レスポンスをパース
    const recommendation = parseRecommendationResponse(responseText)

    if (!recommendation) {
      logger.error('Failed to parse recommendation response', {
        sessionId,
        responseText,
      })
      return NextResponse.json(
        { success: false, error: 'Failed to generate recommendations' },
        { status: 500, headers: corsHeaders }
      )
    }

    logger.info('System recommendation completed', {
      sessionId,
      recommendations: recommendation.recommendations.map((r) => r.systemId),
    })

    // 成功レスポンス
    return NextResponse.json(
      {
        success: true,
        sessionId,
        ...recommendation,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    logger.error('System recommendation error', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    )
  }
}

