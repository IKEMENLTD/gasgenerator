/**
 * キーワードベース検索サービス
 *
 * OpenAI Embedding不要で動作するシンプルな検索
 * 2026-01-27: Anthropic APIのみで動作するRAG用
 */

import { supabaseAdmin } from '../supabase/client'
import { logger } from '../utils/logger'

interface SearchResult {
  chunk_text: string
  similarity: number
  system_id: string
  document_id: string
  doc_type: string
  doc_title: string
  metadata: Record<string, unknown>
}

export class KeywordSearchService {
  /**
   * キーワードでドキュメントを検索
   */
  static async search(
    query: string,
    limit: number = 5,
    systemId?: string
  ): Promise<SearchResult[]> {
    try {
      // クエリからキーワードを抽出（日本語対応）
      const keywords = this.extractKeywords(query)

      if (keywords.length === 0) {
        logger.warn('No keywords extracted from query', { query })
        return []
      }

      logger.info('Keyword search', { keywords, systemId })

      // system_documentsから検索
      let dbQuery = (supabaseAdmin as any)
        .from('system_documents')
        .select(`
          id,
          system_id,
          doc_type,
          title,
          content,
          metadata,
          systems!inner(name)
        `)

      if (systemId) {
        dbQuery = dbQuery.eq('system_id', systemId)
      }

      const { data: documents, error } = await dbQuery

      if (error) {
        logger.error('Keyword search DB error', { error })
        return []
      }

      if (!documents || documents.length === 0) {
        return []
      }

      // スコア計算してランキング
      const results: SearchResult[] = documents
        .map((doc: any) => {
          const score = this.calculateScore(doc.content, doc.title, keywords)
          return {
            chunk_text: this.extractRelevantChunk(doc.content, keywords),
            similarity: score,
            system_id: doc.system_id,
            document_id: doc.id,
            doc_type: doc.doc_type,
            doc_title: doc.title,
            metadata: {
              system_name: doc.systems?.name,
              doc_type: doc.doc_type,
              doc_title: doc.title
            }
          }
        })
        .filter((r: SearchResult) => r.similarity > 0)
        .sort((a: SearchResult, b: SearchResult) => b.similarity - a.similarity)
        .slice(0, limit)

      logger.info('Keyword search results', {
        query: query.slice(0, 50),
        resultsCount: results.length
      })

      return results
    } catch (error) {
      logger.error('KeywordSearchService.search error', { error })
      return []
    }
  }

  /**
   * クエリからキーワードを抽出
   */
  private static extractKeywords(query: string): string[] {
    // 日本語の助詞・助動詞などを除去
    const stopWords = [
      'の', 'に', 'は', 'を', 'が', 'と', 'で', 'て', 'た', 'し', 'へ',
      'から', 'まで', 'より', 'など', 'について', 'という', 'ため',
      'これ', 'それ', 'あれ', 'この', 'その', 'どの', 'どう', 'なに',
      'です', 'ます', 'ました', 'ください', 'ありますか', 'できますか',
      'what', 'how', 'when', 'where', 'why', 'which', 'is', 'are', 'the', 'a', 'an'
    ]

    // 記号を除去し、空白・句読点で分割
    const words = query
      .replace(/[?？!！。、.,\n\r]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2)
      .filter(word => !stopWords.includes(word.toLowerCase()))

    // 重複を除去
    return [...new Set(words)]
  }

  /**
   * スコア計算（TF-IDF簡易版）
   */
  private static calculateScore(content: string, title: string, keywords: string[]): number {
    const lowerContent = content.toLowerCase()
    const lowerTitle = title.toLowerCase()

    let score = 0

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase()

      // タイトルにマッチ（高スコア）
      if (lowerTitle.includes(lowerKeyword)) {
        score += 3
      }

      // 本文にマッチ
      const contentMatches = (lowerContent.match(new RegExp(lowerKeyword, 'gi')) || []).length
      score += Math.min(contentMatches, 5) // 最大5回までカウント
    }

    // 正規化（0-1の範囲に）
    const maxPossibleScore = keywords.length * 8 // タイトル3 + 本文5
    return Math.min(score / maxPossibleScore, 1)
  }

  /**
   * キーワードを含む関連部分を抽出
   */
  private static extractRelevantChunk(content: string, keywords: string[]): string {
    const chunkSize = 500
    let bestStart = 0
    let bestScore = 0

    // コンテンツをスライドしながらベストな部分を探す
    for (let i = 0; i < content.length - chunkSize; i += 100) {
      const chunk = content.slice(i, i + chunkSize)
      let score = 0

      for (const keyword of keywords) {
        if (chunk.toLowerCase().includes(keyword.toLowerCase())) {
          score++
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestStart = i
      }
    }

    // ベストな部分を返す
    let chunk = content.slice(bestStart, bestStart + chunkSize)

    // 文の途中で切れないように調整
    const lastPeriod = chunk.lastIndexOf('。')
    if (lastPeriod > chunkSize * 0.5) {
      chunk = chunk.slice(0, lastPeriod + 1)
    }

    return chunk.trim()
  }
}

export default KeywordSearchService
