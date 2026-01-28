/**
 * RAG Query API
 *
 * システムドキュメントに対する質問応答API
 * POST /api/rag/query
 *
 * 2026-01-27: Anthropic APIのみで動作（キーワード検索）
 */

import { NextRequest, NextResponse } from 'next/server'
import { QAService } from '@/lib/rag/qa-service'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const maxDuration = 30

interface QueryRequest {
  question: string
  systemSlug?: string
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as QueryRequest

    if (!body.question || typeof body.question !== 'string') {
      return NextResponse.json(
        { error: 'question is required' },
        { status: 400 }
      )
    }

    // Anthropic API Keyチェック
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        {
          error: 'ANTHROPIC_API_KEY not configured',
          message: 'RAG機能を使用するにはAnthropic API Keyの設定が必要です'
        },
        { status: 503 }
      )
    }

    logger.info('RAG query received', {
      question: body.question.substring(0, 100),
      systemSlug: body.systemSlug
    })

    // QAServiceで回答を生成
    const result = await QAService.answerQuestion(
      body.question,
      body.systemSlug
    )

    return NextResponse.json({
      success: true,
      question: body.question,
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence,
      search_method: result.search_method,
      systemSlug: body.systemSlug || null
    })

  } catch (error) {
    logger.error('RAG query error', { error })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// ヘルスチェック用
export async function GET() {
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY
  const hasOpenAIKey = !!process.env.OPENAI_API_KEY

  return NextResponse.json({
    service: 'RAG Query API',
    status: hasAnthropicKey ? 'ready' : 'waiting_for_api_key',
    capabilities: {
      anthropic_configured: hasAnthropicKey,
      openai_configured: hasOpenAIKey,
      search_method: hasOpenAIKey ? 'embedding + keyword' : 'keyword only'
    },
    message: hasAnthropicKey
      ? 'RAG APIは利用可能です'
      : 'ANTHROPIC_API_KEYの設定が必要です'
  })
}
