/**
 * キーワードベース検索サービス
 *
 * OpenAI Embedding不要で動作するシンプルな検索
 * 2026-01-27: Anthropic APIのみで動作するRAG用
 * 2026-01-28: 検索精度改善
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

      logger.info('Keyword search started', {
        query: query.slice(0, 50),
        keywords,
        systemId
      })

      // system_documentsから検索（シンプルなクエリ）
      let dbQuery = (supabaseAdmin as any)
        .from('system_documents')
        .select('id, system_id, doc_type, title, content, metadata')

      if (systemId) {
        dbQuery = dbQuery.eq('system_id', systemId)
      }

      const { data: documents, error } = await dbQuery

      if (error) {
        logger.error('Keyword search DB error', { error })
        return []
      }

      logger.info('Documents fetched', { count: documents?.length || 0 })

      if (!documents || documents.length === 0) {
        logger.warn('No documents found')
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
        resultsCount: results.length,
        topScore: results[0]?.similarity || 0
      })

      return results
    } catch (error) {
      logger.error('KeywordSearchService.search error', { error })
      return []
    }
  }

  /**
   * クエリからキーワードを抽出（改善版）
   */
  private static extractKeywords(query: string): string[] {
    // 日本語の助詞・助動詞などを除去
    const stopWords = [
      'の', 'に', 'は', 'を', 'が', 'と', 'で', 'て', 'た', 'し', 'へ',
      'から', 'まで', 'より', 'など', 'について', 'という', 'ため',
      'これ', 'それ', 'あれ', 'この', 'その', 'どの', 'どう', 'なに',
      'です', 'ます', 'ました', 'ください', 'ありますか', 'できますか',
      'ですか', 'ますか', 'てください', 'について', '教えて',
      'what', 'how', 'when', 'where', 'why', 'which', 'is', 'are', 'the', 'a', 'an'
    ]

    // 記号を除去し、空白・句読点で分割
    let words = query
      .replace(/[?？!！。、.,\n\r]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 2)
      .filter(word => !stopWords.includes(word.toLowerCase()))

    // 複合語も追加（例: "セットアップ手順" → ["セットアップ", "手順", "セットアップ手順"]）
    const compoundWords: string[] = []
    for (let i = 0; i < words.length - 1; i++) {
      compoundWords.push(words[i] + words[i + 1])
    }

    // 重複を除去して結合
    const allWords = [...new Set([...words, ...compoundWords])]

    // キーワードがない場合は元のクエリから単語を抽出（最低限）
    if (allWords.length === 0) {
      return query.split(/\s+/).filter(w => w.length >= 2).slice(0, 5)
    }

    return allWords
  }

  /**
   * スコア計算（TF-IDF簡易版、改善）
   */
  private static calculateScore(content: string, title: string, keywords: string[]): number {
    const lowerContent = content.toLowerCase()
    const lowerTitle = title.toLowerCase()

    let score = 0
    let matchedKeywords = 0

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase()

      // タイトルにマッチ（高スコア）
      if (lowerTitle.includes(lowerKeyword)) {
        score += 5
        matchedKeywords++
      }

      // 本文にマッチ
      const contentMatches = (lowerContent.match(new RegExp(this.escapeRegex(lowerKeyword), 'gi')) || []).length
      if (contentMatches > 0) {
        score += Math.min(contentMatches * 2, 10) // 最大10点
        matchedKeywords++
      }
    }

    // マッチしたキーワードがない場合は0
    if (matchedKeywords === 0) {
      return 0
    }

    // 正規化（0-1の範囲に）
    const maxPossibleScore = keywords.length * 15 // タイトル5 + 本文10
    return Math.min(score / maxPossibleScore, 1)
  }

  /**
   * 正規表現の特殊文字をエスケープ
   */
  private static escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  /**
   * キーワードを含む関連部分を抽出（改善版）
   */
  private static extractRelevantChunk(content: string, keywords: string[]): string {
    const chunkSize = 500
    let bestStart = 0
    let bestScore = 0

    // コンテンツをスライドしながらベストな部分を探す
    const step = Math.max(50, Math.floor(content.length / 20))
    for (let i = 0; i < content.length - chunkSize; i += step) {
      const chunk = content.slice(i, i + chunkSize)
      let score = 0

      for (const keyword of keywords) {
        const regex = new RegExp(this.escapeRegex(keyword), 'gi')
        const matches = chunk.match(regex)
        if (matches) {
          score += matches.length
        }
      }

      if (score > bestScore) {
        bestScore = score
        bestStart = i
      }
    }

    // ベストスコアが0の場合は先頭から返す
    if (bestScore === 0) {
      return content.slice(0, chunkSize).trim()
    }

    // ベストな部分を返す
    let chunk = content.slice(bestStart, bestStart + chunkSize)

    // 文の途中で切れないように調整
    const lastPeriod = chunk.lastIndexOf('。')
    const lastNewline = chunk.lastIndexOf('\n')
    const breakPoint = Math.max(lastPeriod, lastNewline)

    if (breakPoint > chunkSize * 0.3) {
      chunk = chunk.slice(0, breakPoint + 1)
    }

    return chunk.trim()
  }
}

export default KeywordSearchService
