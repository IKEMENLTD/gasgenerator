/**
 * RAG Embedding API
 *
 * ドキュメントをベクトル化してDBに保存
 * POST /api/rag/embed
 */

import { NextRequest, NextResponse } from 'next/server'
import { EmbeddingService } from '@/lib/rag/embedding-service'
import { supabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5分（大量ドキュメント処理用）

interface EmbedRequest {
  systemId?: string
  documentId?: string
  processAll?: boolean
}

export async function POST(request: NextRequest) {
  try {
    // 簡易認証（本番では適切な認証を実装）
    const authHeader = request.headers.get('authorization')
    const adminKey = process.env.ADMIN_API_KEY

    if (adminKey && authHeader !== `Bearer ${adminKey}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // OpenAI API Keyチェック
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'OPENAI_API_KEY not configured',
          message: 'Embedding生成にはOpenAI API Keyの設定が必要です'
        },
        { status: 503 }
      )
    }

    const body = await request.json() as EmbedRequest

    logger.info('Embedding request received', {
      systemId: body.systemId,
      documentId: body.documentId,
      processAll: body.processAll
    })

    let result: { processed: number; total: number }

    if (body.processAll) {
      // 全ドキュメントを処理
      result = await EmbeddingService.processAllDocuments()
    } else if (body.documentId) {
      // 特定ドキュメントを処理
      const { data: doc, error } = await (supabaseAdmin as any)
        .from('system_documents')
        .select('*')
        .eq('id', body.documentId)
        .single()

      if (error || !doc) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }

      const count = await EmbeddingService.processDocument(doc)
      result = { processed: count > 0 ? 1 : 0, total: 1 }
    } else if (body.systemId) {
      // 特定システムの全ドキュメントを処理
      const { data: docs, error } = await (supabaseAdmin as any)
        .from('system_documents')
        .select('*')
        .eq('system_id', body.systemId)

      if (error || !docs) {
        return NextResponse.json(
          { error: 'System not found or no documents' },
          { status: 404 }
        )
      }

      let processed = 0
      for (const doc of docs) {
        const count = await EmbeddingService.processDocument(doc)
        if (count > 0) processed++
      }
      result = { processed, total: docs.length }
    } else {
      return NextResponse.json(
        { error: 'systemId, documentId, or processAll is required' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      ...result,
      message: `${result.processed}/${result.total} ドキュメントを処理しました`
    })

  } catch (error) {
    logger.error('Embedding error', { error })

    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// 現在のEmbedding状況を確認
export async function GET() {
  try {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY

    // Embedding数を取得
    const { count: embeddingCount } = await (supabaseAdmin as any)
      .from('system_embeddings')
      .select('*', { count: 'exact', head: true })

    // ドキュメント数を取得
    const { count: docCount } = await (supabaseAdmin as any)
      .from('system_documents')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      service: 'RAG Embedding API',
      status: hasOpenAIKey ? 'ready' : 'waiting_for_api_key',
      openai_configured: hasOpenAIKey,
      statistics: {
        total_documents: docCount || 0,
        total_embeddings: embeddingCount || 0
      }
    })
  } catch (error) {
    return NextResponse.json({
      service: 'RAG Embedding API',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
