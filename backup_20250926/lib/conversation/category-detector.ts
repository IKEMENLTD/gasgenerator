import { ClaudeApiClient } from '../claude/client'
import { logger } from '../utils/logger'
import { CATEGORY_DEFINITIONS } from './category-definitions'

export class CategoryDetector {
  private static claudeClient = new ClaudeApiClient()

  /**
   * メッセージ内容から自動的にカテゴリを検出
   */
  static async detectFromMessage(messageText: string, userId?: string): Promise<string | null> {
    try {
      // まずキーワードベースの簡易判定
      const keywordCategory = this.detectByKeywords(messageText)
      if (keywordCategory) {
        logger.info('Category detected by keywords', { category: keywordCategory, messageText })
        return keywordCategory
      }

      // AIを使った高度な判定
      const prompt = `あなたはメッセージ分類の専門家です。
以下のメッセージから、Google Apps Scriptで実装したい機能のカテゴリを判定してください。

メッセージ：
「${messageText}」

カテゴリ一覧：
- spreadsheet: スプレッドシート操作（データ集計、転記、グラフ作成など）
- gmail: Gmail自動化（メール送信、返信、添付ファイル処理など）
- calendar: カレンダー連携（予定作成、リマインダー、通知など）
- api: API連携（外部サービス連携、Webhook、データ取得など）
- custom: その他（上記に当てはまらない場合）

以下のJSON形式で返してください：
{
  "category": "カテゴリID",
  "confidence": 信頼度（0-100）,
  "reason": "判定理由"
}

注意：
- 明確に判断できない場合はnullを返す
- 複数カテゴリに該当する場合は最も主要なものを選択
- confidenceが50未満の場合はnullを返す`

      const response = await this.claudeClient.sendMessage(
        [{ role: 'user', content: prompt }],
        userId,
        3,
        1000 // トークン制限
      )

      // レスポンスからJSONを抽出
      const responseText = response.content[0].text
      let jsonMatch = responseText.match(/```json\n([\s\S]*?)```/)
      if (!jsonMatch) {
        jsonMatch = responseText.match(/\{[\s\S]*\}/)
      }

      if (!jsonMatch) {
        logger.warn('Could not extract JSON from AI response')
        return null
      }

      const jsonString = jsonMatch[1] || jsonMatch[0]
      const result = JSON.parse(jsonString)

      // 信頼度チェック
      if (result.confidence < 50 || result.category === null) {
        logger.info('Low confidence or null category', {
          confidence: result.confidence,
          reason: result.reason
        })
        return null
      }

      // カテゴリの妥当性チェック
      if (!CATEGORY_DEFINITIONS[result.category]) {
        logger.warn('Invalid category detected', { category: result.category })
        return null
      }

      logger.info('Category detected by AI', {
        category: result.category,
        confidence: result.confidence,
        reason: result.reason
      })

      return result.category

    } catch (error) {
      logger.error('Failed to detect category', {
        error: error instanceof Error ? error.message : String(error)
      })
      return null
    }
  }

  /**
   * キーワードベースの簡易カテゴリ判定
   */
  private static detectByKeywords(messageText: string): string | null {
    const text = messageText.toLowerCase()

    // スプレッドシート関連のキーワード
    const spreadsheetKeywords = [
      'スプレッドシート', 'spreadsheet', 'シート', 'sheet',
      'エクセル', 'excel', 'csv',
      '集計', '転記', 'グラフ', 'チャート',
      '行', '列', 'セル', '表', 'データ'
    ]

    // Gmail関連のキーワード
    const gmailKeywords = [
      'gmail', 'メール', 'mail', 'email',
      '送信', '返信', '受信', '添付',
      '件名', '本文', 'cc', 'bcc'
    ]

    // カレンダー関連のキーワード
    const calendarKeywords = [
      'カレンダー', 'calendar', 'gcal',
      '予定', 'イベント', 'event',
      'リマインダー', 'reminder', '通知',
      '会議', 'ミーティング'
    ]

    // API関連のキーワード
    const apiKeywords = [
      'api', 'webhook', 'slack', 'line',
      'twitter', 'chatwork', 'teams',
      '連携', '外部', 'サービス',
      'post', 'get', 'http'
    ]

    // カウント
    const counts = {
      spreadsheet: spreadsheetKeywords.filter(k => text.includes(k)).length,
      gmail: gmailKeywords.filter(k => text.includes(k)).length,
      calendar: calendarKeywords.filter(k => text.includes(k)).length,
      api: apiKeywords.filter(k => text.includes(k)).length
    }

    // 最も多くマッチしたカテゴリを選択
    const maxCount = Math.max(...Object.values(counts))
    if (maxCount === 0) {
      return null
    }

    for (const [category, count] of Object.entries(counts)) {
      if (count === maxCount) {
        return category
      }
    }

    return null
  }
}