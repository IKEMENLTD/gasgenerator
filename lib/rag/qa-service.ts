/**
 * RAG QA (Question-Answering) サービス
 *
 * 2026-01-27: システムに関する質問応答機能
 * 2026-01-27: キーワード検索対応（OpenAI不要）
 */

import { logger } from '../utils/logger'
import { EmbeddingService } from './embedding-service'
import { KeywordSearchService } from './keyword-search'
import { SystemQueries } from '../supabase/subscription-queries'
import Anthropic from '@anthropic-ai/sdk'

// Claude APIクライアント
let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    })
  }
  return anthropicClient
}

interface SearchResult {
  chunk_text: string
  similarity: number
  system_id: string
  document_id: string
  metadata: Record<string, unknown>
}

interface QAResponse {
  answer: string
  sources: Array<{
    system_name?: string
    doc_title?: string
    chunk_text: string
  }>
  confidence: 'high' | 'medium' | 'low'
  search_method: 'embedding' | 'keyword'
}

export class QAService {
  /**
   * 検索メソッドを自動選択
   * OpenAI API Keyがあればembedding、なければkeyword
   */
  private static async searchDocuments(
    query: string,
    limit: number,
    systemId?: string
  ): Promise<{ results: SearchResult[]; method: 'embedding' | 'keyword' }> {
    // OpenAI API Keyがあればembedding検索を試みる
    if (process.env.OPENAI_API_KEY) {
      try {
        const results = await EmbeddingService.searchSimilar(query, limit, systemId)
        if (results.length > 0) {
          return { results, method: 'embedding' }
        }
      } catch (error) {
        logger.warn('Embedding search failed, falling back to keyword search', { error })
      }
    }

    // キーワード検索にフォールバック
    const results = await KeywordSearchService.search(query, limit, systemId)
    return { results: results as SearchResult[], method: 'keyword' }
  }

  /**
   * システムに関する質問に回答
   */
  static async answerQuestion(
    question: string,
    systemSlug?: string
  ): Promise<QAResponse> {
    try {
      // Anthropic API Keyチェック
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          answer: 'ANTHROPIC_API_KEYが設定されていません。管理者にお問い合わせください。',
          sources: [],
          confidence: 'low',
          search_method: 'keyword'
        }
      }

      // 1. システムIDを取得（指定された場合）
      let systemId: string | undefined
      let systemName: string | undefined

      if (systemSlug) {
        const system = await SystemQueries.getSystemBySlug(systemSlug)
        if (system) {
          systemId = system.id
          systemName = system.name
        }
      }

      // 2. 関連ドキュメントを検索（自動でembeddingまたはkeywordを選択）
      const { results: relevantChunks, method: searchMethod } = await this.searchDocuments(
        question,
        5,
        systemId
      )

      if (relevantChunks.length === 0) {
        return {
          answer: 'この質問に関連する情報が見つかりませんでした。別の質問をお試しください。',
          sources: [],
          confidence: 'low',
          search_method: searchMethod
        }
      }

      // 3. コンテキストを構築
      const context = relevantChunks
        .map((chunk, i) => `[情報${i + 1}]\n${chunk.chunk_text}`)
        .join('\n\n')

      // 4. Claude APIで回答生成
      const client = getAnthropicClient()

      const systemPrompt = `あなたはTaskMateのアシスタントです。
ユーザーの質問に対して、提供されたコンテキスト情報のみを使って回答してください。

ルール:
1. コンテキストにない情報は回答に含めないでください
2. 回答は日本語で、丁寧に説明してください
3. 技術的な用語は必要に応じて簡単な説明を添えてください
4. 不明な点がある場合は正直に「この情報はありません」と伝えてください
${systemName ? `5. 質問は「${systemName}」というシステムについてです` : ''}`

      const userPrompt = `以下のコンテキスト情報を参考にして、質問に回答してください。

コンテキスト:
${context}

質問: ${question}`

      const response = await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })

      const answer = response.content[0].type === 'text'
        ? response.content[0].text
        : 'テキスト応答を取得できませんでした'

      // 5. 信頼度を評価
      const avgSimilarity = relevantChunks.reduce((sum, c) => sum + c.similarity, 0) / relevantChunks.length
      let confidence: 'high' | 'medium' | 'low'

      if (searchMethod === 'embedding') {
        // embedding検索の場合
        if (avgSimilarity > 0.85) confidence = 'high'
        else if (avgSimilarity > 0.75) confidence = 'medium'
        else confidence = 'low'
      } else {
        // keyword検索の場合
        if (avgSimilarity > 0.5) confidence = 'high'
        else if (avgSimilarity > 0.3) confidence = 'medium'
        else confidence = 'low'
      }

      // 6. ソース情報を整形
      const sources = relevantChunks.map(chunk => ({
        system_name: (chunk.metadata as any)?.system_name || undefined,
        doc_title: (chunk.metadata as any)?.doc_title || undefined,
        chunk_text: chunk.chunk_text.slice(0, 200) + (chunk.chunk_text.length > 200 ? '...' : '')
      }))

      logger.info('QA completed', {
        question: question.slice(0, 50),
        chunksFound: relevantChunks.length,
        confidence,
        avgSimilarity,
        searchMethod
      })

      return {
        answer,
        sources,
        confidence,
        search_method: searchMethod
      }
    } catch (error) {
      logger.error('QAService.answerQuestion error', { error })
      return {
        answer: 'エラーが発生しました。しばらく経ってからもう一度お試しください。',
        sources: [],
        confidence: 'low',
        search_method: 'keyword'
      }
    }
  }

  /**
   * システム紹介文を生成
   */
  static async generateSystemSummary(systemSlug: string): Promise<string | null> {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        return null
      }

      const system = await SystemQueries.getSystemBySlug(systemSlug)
      if (!system) {
        return null
      }

      // 関連ドキュメントを取得
      const { results: relevantChunks } = await this.searchDocuments(
        `${system.name}の機能と特徴`,
        3,
        system.id
      )

      const context = relevantChunks
        .map(c => c.chunk_text)
        .join('\n\n')

      const client = getAnthropicClient()

      const prompt = `以下の情報を元に、「${system.name}」というシステムの紹介文を150文字程度で作成してください。

システム情報:
- 名前: ${system.name}
- カテゴリ: ${system.category || '未分類'}
- 説明: ${system.description || 'なし'}

関連ドキュメント:
${context}

紹介文は以下の点を含めてください:
1. 何ができるシステムか
2. どんな人におすすめか
3. 主な特徴

シンプルで分かりやすい日本語で書いてください。`

      const response = await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 300,
        messages: [
          { role: 'user', content: prompt }
        ]
      })

      return response.content[0].type === 'text'
        ? response.content[0].text
        : null
    } catch (error) {
      logger.error('QAService.generateSystemSummary error', { error })
      return null
    }
  }

  /**
   * よくある質問を生成
   */
  static async generateFAQ(systemSlug: string): Promise<Array<{ question: string; answer: string }>> {
    try {
      if (!process.env.ANTHROPIC_API_KEY) {
        return []
      }

      const system = await SystemQueries.getSystemBySlug(systemSlug)
      if (!system) {
        return []
      }

      // 関連ドキュメントを取得
      const { results: relevantChunks } = await this.searchDocuments(
        `${system.name}の使い方 設定 トラブル`,
        5,
        system.id
      )

      const context = relevantChunks
        .map(c => c.chunk_text)
        .join('\n\n')

      const client = getAnthropicClient()

      const prompt = `以下の情報を元に、「${system.name}」についてのよくある質問(FAQ)を3つ作成してください。

システム情報:
- 名前: ${system.name}
- カテゴリ: ${system.category || '未分類'}

関連ドキュメント:
${context}

以下のJSON形式で出力してください:
[
  {"question": "質問1", "answer": "回答1"},
  {"question": "質問2", "answer": "回答2"},
  {"question": "質問3", "answer": "回答3"}
]

質問は具体的で、回答は50〜100文字程度でシンプルにしてください。
JSONのみを出力し、他のテキストは含めないでください。`

      const response = await client.messages.create({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 500,
        messages: [
          { role: 'user', content: prompt }
        ]
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''

      // JSONをパース
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      return []
    } catch (error) {
      logger.error('QAService.generateFAQ error', { error })
      return []
    }
  }
}

export default QAService
