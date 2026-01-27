/**
 * RAG用 Embeddingサービス
 *
 * 2026-01-27: システムドキュメントのベクトル化
 */

import { logger } from '../utils/logger'
import { supabaseAdmin } from '../supabase/client'
import { SystemDocument, InsertSystemEmbedding } from '../supabase/subscription-types'

// OpenAI Embedding APIのレスポンス型
interface EmbeddingResponse {
  object: string
  data: Array<{
    object: string
    index: number
    embedding: number[]
  }>
  model: string
  usage: {
    prompt_tokens: number
    total_tokens: number
  }
}

// チャンク設定
const CHUNK_SIZE = 1000  // 1チャンクあたりの最大文字数
const CHUNK_OVERLAP = 200  // チャンク間のオーバーラップ

export class EmbeddingService {
  private static openaiApiKey = process.env.OPENAI_API_KEY

  /**
   * テキストをチャンクに分割
   */
  static splitIntoChunks(text: string): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      let end = start + CHUNK_SIZE

      // 文の途中で切らないように調整
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('。', end)
        const lastNewline = text.lastIndexOf('\n', end)
        const breakPoint = Math.max(lastPeriod, lastNewline)

        if (breakPoint > start) {
          end = breakPoint + 1
        }
      }

      const chunk = text.slice(start, end).trim()
      if (chunk.length > 0) {
        chunks.push(chunk)
      }

      start = end - CHUNK_OVERLAP
      if (start < 0) start = 0
    }

    return chunks
  }

  /**
   * OpenAI APIでテキストをembeddingに変換
   */
  static async createEmbedding(text: string): Promise<number[] | null> {
    if (!this.openaiApiKey) {
      logger.error('OPENAI_API_KEY is not set')
      return null
    }

    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiApiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-ada-002',
          input: text
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        logger.error('OpenAI Embedding API error', { error: errorData })
        return null
      }

      const data = await response.json() as EmbeddingResponse
      return data.data[0].embedding
    } catch (error) {
      logger.error('EmbeddingService.createEmbedding error', { error })
      return null
    }
  }

  /**
   * ドキュメントをチャンク化してembeddingを作成・保存
   */
  static async processDocument(document: SystemDocument): Promise<number> {
    const chunks = this.splitIntoChunks(document.content)
    let savedCount = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = await this.createEmbedding(chunk)

      if (embedding) {
        const embeddingData: InsertSystemEmbedding = {
          system_id: document.system_id,
          document_id: document.id,
          chunk_index: i,
          chunk_text: chunk,
          embedding_json: embedding,
          metadata: {
            doc_type: document.doc_type,
            doc_title: document.title,
            total_chunks: chunks.length
          }
        }

        const { error } = await (supabaseAdmin as any)
          .from('system_embeddings')
          .insert(embeddingData)

        if (error) {
          logger.error('Failed to save embedding', { error, documentId: document.id, chunkIndex: i })
        } else {
          savedCount++
        }
      }

      // APIレート制限対策
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    logger.info('Document processed', {
      documentId: document.id,
      totalChunks: chunks.length,
      savedChunks: savedCount
    })

    return savedCount
  }

  /**
   * 全ドキュメントを処理（バッチ処理）
   */
  static async processAllDocuments(): Promise<{ total: number; processed: number }> {
    const { data: documents, error } = await (supabaseAdmin as any)
      .from('system_documents')
      .select('*')

    if (error || !documents) {
      logger.error('Failed to fetch documents', { error })
      return { total: 0, processed: 0 }
    }

    let processed = 0
    for (const doc of documents) {
      const count = await this.processDocument(doc)
      if (count > 0) processed++
    }

    return { total: documents.length, processed }
  }

  /**
   * 類似ドキュメントを検索（コサイン類似度）
   */
  static async searchSimilar(
    queryText: string,
    limit: number = 5,
    systemId?: string
  ): Promise<Array<{
    chunk_text: string
    similarity: number
    system_id: string
    document_id: string
    metadata: Record<string, unknown>
  }>> {
    // クエリテキストのembeddingを取得
    const queryEmbedding = await this.createEmbedding(queryText)
    if (!queryEmbedding) {
      return []
    }

    // pgvectorが有効な場合はRPC関数を使用
    // pgvectorが無効な場合はJSON配列で計算

    try {
      // まずpgvectorを試す
      const { data, error } = await (supabaseAdmin as any)
        .rpc('search_embeddings', {
          query_embedding: queryEmbedding,
          match_threshold: 0.7,
          match_count: limit,
          filter_system_id: systemId || null
        })

      if (!error && data) {
        return data
      }

      // pgvectorが使えない場合はクライアント側で計算
      return await this.searchSimilarFallback(queryEmbedding, limit, systemId)
    } catch (error) {
      logger.warn('pgvector search failed, using fallback', { error })
      return await this.searchSimilarFallback(queryEmbedding, limit, systemId)
    }
  }

  /**
   * pgvectorが使えない場合のフォールバック検索
   */
  private static async searchSimilarFallback(
    queryEmbedding: number[],
    limit: number,
    systemId?: string
  ): Promise<Array<{
    chunk_text: string
    similarity: number
    system_id: string
    document_id: string
    metadata: Record<string, unknown>
  }>> {
    let query = (supabaseAdmin as any)
      .from('system_embeddings')
      .select('*')

    if (systemId) {
      query = query.eq('system_id', systemId)
    }

    const { data: embeddings, error } = await query

    if (error || !embeddings) {
      logger.error('Failed to fetch embeddings', { error })
      return []
    }

    // コサイン類似度を計算
    const results = embeddings
      .map((emb: any) => {
        const embVector = emb.embedding_json as number[]
        if (!embVector || embVector.length !== queryEmbedding.length) {
          return null
        }

        const similarity = this.cosineSimilarity(queryEmbedding, embVector)
        return {
          chunk_text: emb.chunk_text,
          similarity,
          system_id: emb.system_id,
          document_id: emb.document_id,
          metadata: emb.metadata || {}
        }
      })
      .filter((r: any) => r !== null && r.similarity > 0.7)
      .sort((a: any, b: any) => b.similarity - a.similarity)
      .slice(0, limit)

    return results
  }

  /**
   * コサイン類似度を計算
   */
  private static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0

    let dotProduct = 0
    let normA = 0
    let normB = 0

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
    if (magnitude === 0) return 0

    return dotProduct / magnitude
  }
}

export default EmbeddingService
