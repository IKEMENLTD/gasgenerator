import { CodeQueries } from '@/lib/supabase/queries'
import { logger } from '@/lib/utils/logger'
import { CLAUDE_CONFIG } from '@/lib/constants/config'
import type { 
  CodeGenerationRequest, 
  UserCodeHistory, 
  PromptComponents 
} from '@/types/claude'

export class PromptBuilder {
  /**
   * コード生成用プロンプトを構築（トークン制限厳守）
   */
  static async buildCodeGenerationPrompt(
    request: CodeGenerationRequest
  ): Promise<string> {
    try {
      logger.debug('Building code generation prompt', { 
        category: request.category,
        subcategory: request.subcategory,
        detailsLength: request.requirements?.details?.length || 0
      })

      // 各コンポーネントを構築
      const components = await this.buildPromptComponents(request)
      
      // トークン制限内で組み立て
      const prompt = this.assemblePrompt(components)
      
      // トークン数チェック（概算）
      const estimatedTokens = this.estimateTokenCount(prompt)
      if (estimatedTokens > CLAUDE_CONFIG.MAX_INPUT_TOKENS) {
        logger.warn('Prompt may exceed token limit', { 
          estimatedTokens, 
          limit: CLAUDE_CONFIG.MAX_INPUT_TOKENS 
        })
        
        // 長すぎる場合は履歴を削減
        return this.assemblePrompt({
          ...components,
          userContext: this.truncateUserContext(components.userContext)
        })
      }

      return prompt

    } catch (error) {
      logger.error('Failed to build prompt', { error })
      // フォールバック：最小限のプロンプト
      return this.buildFallbackPrompt(request)
    }
  }

  /**
   * プロンプトコンポーネントを構築
   */
  private static async buildPromptComponents(
    request: CodeGenerationRequest
  ): Promise<PromptComponents> {
    return {
      systemPrompt: this.getSystemPrompt(),
      userContext: await this.buildUserContext(request.userId, request.category),
      categoryContext: this.buildCategoryContext(request.category, request.subcategory),
      requestDetails: this.buildRequestDetails(request)
    }
  }

  /**
   * システムプロンプト（固定、800トークン想定）
   */
  private static getSystemPrompt(): string {
    return `あなたはGoogle Apps Script専門のコード生成AIです。

【出力形式】
以下の3つのセクションを含めて応答してください：

[CODE_START]
実際のGASコード（日本語コメント付き）
[CODE_END]

[EXPLANATION_START]
機能説明（100文字以内）
[EXPLANATION_END]

[STEPS_START]
1. 手順1
2. 手順2
3. 手順3
[STEPS_END]

【コーディング規則】
1. 関数名：わかりやすい日本語英語
2. エラーハンドリング：try-catch必須
3. ログ：Logger.log で状況出力（GAS標準）
4. 効率化：getValues/setValues使用
5. 実行時間：6分以内完了を意識

【対象API】
SpreadsheetApp, GmailApp, CalendarApp, UrlFetchApp, DriveApp

【禁止事項】
- 個人情報取得コード
- 外部サーバー攻撃コード
- 非効率な全行スキャン
- 非推奨API使用`
  }

  /**
   * ユーザーコンテキスト構築（400トークン以内）
   */
  private static async buildUserContext(
    userId: string, 
    currentCategory: string
  ): Promise<string> {
    try {
      // 過去のコード履歴を取得（最大3件）
      const recentCodes = await CodeQueries.getRecentCodes(userId, 3)
      
      if (recentCodes.length === 0) {
        return "【初回ユーザー】基本的なコメントで丁寧に説明してください。"
      }

      // スキルレベル判定
      const skillLevel = this.determineSkillLevel(recentCodes)
      
      // 類似カテゴリの過去実績
      const similarCodes = recentCodes.filter((code: any) => 
        code.code_category === currentCategory
      )

      let context = `【ユーザー情報】レベル:${skillLevel}, 利用回数:${recentCodes.length}`
      
      if (similarCodes.length > 0) {
        const successRate = similarCodes.filter((code: any) => 
          code.user_feedback === 'success'
        ).length / similarCodes.length

        context += `, ${currentCategory}成功率:${Math.round(successRate * 100)}%`
      }

      // 最近の傾向
      const categories = recentCodes.map((code: any) => code.code_category)
      const uniqueCategories = Array.from(new Set(categories))
      
      if (uniqueCategories.length > 1) {
        context += `, 得意分野:${uniqueCategories.slice(0, 2).join(',')}`
      }

      return context

    } catch (error) {
      logger.error('Failed to build user context', { userId, error })
      return "【ユーザー情報】初回または履歴取得エラー"
    }
  }

  /**
   * スキルレベル判定
   */
  private static determineSkillLevel(history: any[]): string {
    if (history.length === 0) return '初心者'
    
    const successRate = history.filter(h => h.user_feedback === 'success').length / history.length
    const totalCodes = history.length
    
    if (successRate >= 0.8 && totalCodes >= 5) return '上級者'
    if (successRate >= 0.6 && totalCodes >= 3) return '中級者'
    return '初心者'
  }

  /**
   * カテゴリ別コンテキスト（300トークン以内）
   */
  private static buildCategoryContext(category: string, subcategory?: string): string {
    const contexts: Record<string, string> = {
      spreadsheet: `【スプレッドシート専用】
- getLastRow(), getLastColumn() で動的範囲取得
- 空セル対応：値 || '' で初期化
- バッチ処理：getValues() で一括取得
- エラー例：範囲外参照、権限不足、シート名間違い`,

      gmail: `【Gmail専用】
- 送信制限：1日500通考慮
- 宛先確認：送信前に validateEmail() 実行
- 添付制限：25MB以下
- エラー例：認証失敗、容量超過、不正な宛先`,

      calendar: `【カレンダー専用】
- タイムゾーン：必ずSession.getScriptTimeZone()使用
- 重複防止：既存イベント確認
- 日時形式：new Date()で正確な時刻設定
- エラー例：権限不足、不正な日時形式`,

      api: `【API連携専用】
- レート制限：適切な間隔でリクエスト
- エラーハンドリング：HTTPステータス確認
- データ形式：JSON.parse/stringify使用
- エラー例：認証失敗、API制限、ネットワークエラー`,

      custom: `【その他・汎用】
- 既存APIの組み合わせを活用
- 処理時間を意識した効率的な実装
- 適切なログ出力でデバッグしやすく`
    }

    return contexts[category] || contexts.custom
  }

  /**
   * リクエスト詳細構築（300トークン以内）
   */
  private static buildRequestDetails(request: CodeGenerationRequest): string {
    // detailsまたはrequirementsの内容を取得（nullチェック付き）
    const rawDetails = request.requirements?.details || 
                      request.requirements?.requirements || 
                      request.requirements || 
                      '詳細なし'
    
    // 文字列に変換してから substring を実行
    const details = typeof rawDetails === 'string' 
      ? rawDetails.substring(0, 200) 
      : JSON.stringify(rawDetails).substring(0, 200)
    
    let requestText = `【今回の要求】
カテゴリ：${request.category}
詳細：${details}`

    if (request.subcategory) {
      requestText += `\n種類：${request.subcategory}`
    }

    // 追加の要件があれば含める（nullチェック付き）
    if (request.requirements?.step1 && request.requirements.step1 !== request.category) {
      requestText += `\n選択：${request.requirements.step1}`
    }

    if (request.requirements?.step2 && request.requirements.step2 !== request.subcategory) {
      requestText += `\nオプション：${request.requirements.step2}`
    }

    return requestText
  }

  /**
   * プロンプト組み立て
   */
  private static assemblePrompt(components: PromptComponents): string {
    return `${components.systemPrompt}

${components.userContext}

${components.categoryContext}

${components.requestDetails}`
  }

  /**
   * トークン数概算（1文字 ≈ 0.75トークン として計算）
   */
  private static estimateTokenCount(text: string): number {
    return Math.ceil(text.length * 0.75)
  }

  /**
   * ユーザーコンテキストの短縮
   */
  private static truncateUserContext(userContext: string): string {
    if (userContext.length <= 200) return userContext
    return userContext.substring(0, 200) + "..."
  }

  /**
   * フォールバックプロンプト（最小限）
   */
  private static buildFallbackPrompt(request: CodeGenerationRequest): string {
    return `${this.getSystemPrompt()}

【要求】
${request.requirements.details.substring(0, 300)}`
  }
}