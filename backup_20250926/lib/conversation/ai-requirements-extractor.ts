import { ClaudeApiClient } from '../claude/client'
import { logger } from '../utils/logger'

export interface ExtractedRequirements {
  mainPurpose: string          // 何をしたいか
  dataSource?: string          // データソース
  processingType?: string      // 処理タイプ
  outputFormat?: string        // 出力形式
  schedule?: string           // 実行タイミング
  specificRequirements: string[] // 具体的な要件
  technicalConstraints?: string[] // 技術的制約
  confidenceLevel: number     // 理解度（0-100）
}

export class AIRequirementsExtractor {
  private static claudeClient = new ClaudeApiClient()

  /**
   * 会話履歴から要件を構造化して抽出
   */
  static async extractFromConversation(
    messages: Array<{ role: string; content: string }>,
    userId?: string
  ): Promise<ExtractedRequirements> {
    try {
      // 最新10メッセージのみ使用（トークン節約）
      const recentMessages = messages.slice(-10)
      const conversationText = recentMessages
        .map(m => `${m.role === 'user' ? 'ユーザー' : 'アシスタント'}: ${m.content.substring(0, 500)}`)
        .join('\n')

      const prompt = `あなたは要件分析の専門家です。
以下の会話から、Google Apps Scriptで実装する要件を抽出してください。

会話内容：
${conversationText}

以下のJSON形式で、要件を構造化して返してください：
{
  "mainPurpose": "主要な目的（必須）",
  "dataSource": "データソース（例：スプレッドシート、API）",
  "processingType": "処理タイプ（例：集計、転記、グラフ作成）",
  "outputFormat": "出力形式（例：シート、メール、PDF）",
  "schedule": "実行タイミング（例：毎日9時、手動実行）",
  "specificRequirements": ["具体的要件1", "具体的要件2"],
  "technicalConstraints": ["技術的制約や条件"],
  "confidenceLevel": 80
}

注意：
- 不明な項目はnullにしてください
- 推測せず、会話から明確に読み取れることだけを記載
- confidenceLevelは理解度を0-100で評価
- mainPurposeは必ず記載`

      const response = await this.claudeClient.sendMessage(
        [{ role: 'user', content: prompt }],
        userId,
        3,
        2000 // トークンをさらに削減
      )

      // レスポンスからJSONを抽出
      const responseText = response.content[0].text

      // JSON部分を抽出（複数パターン対応）
      let jsonMatch = responseText.match(/```json\n([\s\S]*?)```/)
      if (!jsonMatch) {
        jsonMatch = responseText.match(/\{[\s\S]*\}/)
      }

      if (!jsonMatch) {
        logger.warn('Could not extract JSON from AI response', { responseText: responseText.substring(0, 200) })
        throw new Error('Failed to extract JSON from response')
      }

      const jsonString = jsonMatch[1] || jsonMatch[0]
      const extracted = JSON.parse(jsonString) as ExtractedRequirements

      // デフォルト値の設定
      if (!extracted.specificRequirements) {
        extracted.specificRequirements = []
      }
      if (!extracted.confidenceLevel) {
        extracted.confidenceLevel = 50
      }

      logger.info('Requirements extracted by AI', {
        userId,
        confidenceLevel: extracted.confidenceLevel,
        mainPurpose: extracted.mainPurpose
      })

      return extracted

    } catch (error) {
      logger.error('Failed to extract requirements with AI', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        messageCount: messages.length
      })

      // フォールバック：ユーザーメッセージから基本情報を抽出
      const userMessages = messages.filter(m => m.role === 'user')
      const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''

      return {
        mainPurpose: lastUserMessage.substring(0, 200),
        specificRequirements: [lastUserMessage],
        confidenceLevel: 10 // 低い信頼度
      }
    }
  }

  /**
   * 不足している情報を特定
   */
  static identifyMissingInfo(requirements: ExtractedRequirements): string[] {
    const missing: string[] = []

    if (!requirements.dataSource) {
      missing.push('データソース（どのシートやファイルを使うか）')
    }

    if (!requirements.outputFormat) {
      missing.push('出力形式（結果をどこに出力するか）')
    }

    if (requirements.processingType?.includes('自動') && !requirements.schedule) {
      missing.push('実行タイミング（いつ実行するか）')
    }

    if (requirements.confidenceLevel < 70) {
      missing.push('詳細な要件（もう少し具体的に教えてください）')
    }

    return missing
  }

  /**
   * スマートな質問を生成
   */
  static async generateSmartQuestion(
    missingInfo: string[],
    context: ExtractedRequirements
  ): Promise<string> {
    if (missingInfo.length === 0) {
      return ''
    }

    try {
      const prompt = `ユーザーは「${context.mainPurpose}」を実現したいようです。
以下の情報が不足しています：
${missingInfo.slice(0, 3).map(info => `- ${info}`).join('\n')}

親切な日本語で、最も重要な不足情報を1つだけ聞いてください。
選択肢がある場合は2-3個提示してください。`

      const response = await this.claudeClient.sendMessage(
        [{ role: 'user', content: prompt }],
        undefined,
        3,
        300 // さらに削減
      )

      return response.content[0].text
    } catch (error) {
      logger.warn('Failed to generate smart question', { error })
      // フォールバック質問
      return `もう少し詳しく教えていただけますか？\n例えば：${missingInfo[0]}`
    }
  }
}