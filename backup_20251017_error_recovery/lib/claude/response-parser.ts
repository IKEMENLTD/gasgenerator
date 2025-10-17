import { logger } from '@/lib/utils/logger'
import { GeneratedCodeSchema } from '@/lib/utils/validators'
import type { ClaudeApiResponse, ClaudeCodeResponse } from '@/types/claude'

export class ResponseParser {
  /**
   * Claude APIレスポンスを解析して構造化データに変換
   */
  static parseCodeResponse(response: ClaudeApiResponse): ClaudeCodeResponse {
    try {
      const content = response.content[0]?.text || ''
      
      logger.debug('Parsing Claude response', { 
        responseId: response.id,
        contentLength: content.length,
        stopReason: response.stop_reason
      })

      // 1. JSON形式の回答を探す
      const jsonResponse = this.extractJsonResponse(content)
      if (jsonResponse) {
        return this.validateAndNormalize(jsonResponse)
      }

      // 2. マークダウン形式の回答を探す
      const markdownResponse = this.extractMarkdownResponse(content)
      if (markdownResponse) {
        return this.validateAndNormalize(markdownResponse)
      }

      // 3. プレーンテキストから推測
      const plainResponse = this.extractPlainTextResponse(content)
      return this.validateAndNormalize(plainResponse)

    } catch (error) {
      logger.error('Failed to parse Claude response', { 
        responseId: response.id,
        error 
      })
      
      // フォールバック：エラー用のレスポンス
      return this.createFallbackResponse(response.content[0]?.text || '')
    }
  }

  /**
   * JSON形式のレスポンス抽出
   */
  private static extractJsonResponse(content: string): ClaudeCodeResponse | null {
    try {
      // JSONブロックを探す
      const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n```/) || 
                       content.match(/\{[\s\S]*?"code"[\s\S]*?\}/)

      if (!jsonMatch) return null

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      // 必須フィールドの存在確認
      if (parsed.code && parsed.explanation) {
        return {
          code: String(parsed.code).trim(),
          explanation: String(parsed.explanation).trim(),
          steps: Array.isArray(parsed.steps) ? 
            parsed.steps.map((s: any) => String(s).trim()).slice(0, 10) :
            this.generateDefaultSteps()
        }
      }

      return null

    } catch (error) {
      logger.debug('JSON parsing failed', { error })
      return null
    }
  }

  /**
   * マークダウン形式のレスポンス抽出
   */
  private static extractMarkdownResponse(content: string): ClaudeCodeResponse | null {
    try {
      // コードブロックを探す
      const codeMatch = content.match(/```(?:javascript|js)?\s*\n([\s\S]*?)\n```/)
      if (!codeMatch) return null

      const code = codeMatch[1].trim()
      
      // 説明文を探す（コードブロック前後のテキスト）
      const beforeCode = content.substring(0, codeMatch.index || 0)
      const afterCode = content.substring((codeMatch.index || 0) + codeMatch[0].length)
      
      const explanation = this.extractExplanation(beforeCode, afterCode)
      const steps = this.extractSteps(afterCode)

      return {
        code,
        explanation,
        steps: steps.length > 0 ? steps : this.generateDefaultSteps()
      }

    } catch (error) {
      logger.debug('Markdown parsing failed', { error })
      return null
    }
  }

  /**
   * プレーンテキストからの抽出（最終手段）
   */
  private static extractPlainTextResponse(content: string): ClaudeCodeResponse {
    // function で始まる行を探してコード部分を推測
    const lines = content.split('\n')
    const codeLines: string[] = []
    let inCodeBlock = false

    for (const line of lines) {
      if (line.trim().startsWith('function ') || line.includes('SpreadsheetApp') || line.includes('GmailApp')) {
        inCodeBlock = true
      }
      
      if (inCodeBlock) {
        codeLines.push(line)
        
        // }で終わる行でコードブロック終了の可能性
        if (line.trim() === '}' && codeLines.length > 5) {
          break
        }
      }
    }

    const code = codeLines.length > 0 ? codeLines.join('\n').trim() : 
      '// 申し訳ございません。コード生成に失敗しました。\n// もう一度、具体的な要望をお聞かせください。\nfunction sample() {\n  console.log("エラーが発生しました。もう一度お試しください。")\n}'

    const explanation = content.substring(0, 200).trim() || 'コード生成に成功しました'

    return {
      code,
      explanation,
      steps: this.generateDefaultSteps()
    }
  }

  /**
   * 説明文の抽出
   */
  private static extractExplanation(beforeCode: string, afterCode: string): string {
    // コード前の説明を優先
    let explanation = beforeCode.trim().split('\n').slice(-3).join(' ').trim()
    
    if (!explanation || explanation.length < 10) {
      // コード後の説明
      explanation = afterCode.trim().split('\n').slice(0, 3).join(' ').trim()
    }

    // まだ短い場合はデフォルト
    if (!explanation || explanation.length < 10) {
      explanation = '要求に応じたGASコードを生成しました'
    }

    return explanation.substring(0, 200) // 最大200文字
  }

  /**
   * 手順の抽出
   */
  private static extractSteps(text: string): string[] {
    const steps: string[] = []
    
    // 番号付きリストを探す
    const numberedSteps = text.match(/^\d+\.\s*.+$/gm)
    if (numberedSteps) {
      steps.push(...numberedSteps.map(step => step.replace(/^\d+\.\s*/, '').trim()))
    }

    // ダッシュ付きリストを探す
    const dashedSteps = text.match(/^[-*]\s*.+$/gm)
    if (dashedSteps && steps.length === 0) {
      steps.push(...dashedSteps.map(step => step.replace(/^[-*]\s*/, '').trim()))
    }

    return steps.slice(0, 10) // 最大10ステップ
  }

  /**
   * デフォルト手順生成
   */
  private static generateDefaultSteps(): string[] {
    return [
      'Google スプレッドシートを開く',
      '拡張機能 > Apps Script をクリック',
      'コードをコピーして貼り付け',
      '保存して実行'
    ]
  }

  /**
   * レスポンスの検証と正規化
   */
  private static validateAndNormalize(response: ClaudeCodeResponse): ClaudeCodeResponse {
    try {
      // Zodスキーマで検証
      const validated = GeneratedCodeSchema.parse(response)
      
      // コードの基本チェック
      const sanitizedCode = this.sanitizeCode(validated.code)
      
      return {
        code: sanitizedCode,
        explanation: validated.explanation.substring(0, 500), // 最大500文字
        steps: validated.steps.map(step => step.substring(0, 100)) // 各ステップ最大100文字
      }

    } catch (error) {
      logger.warn('Response validation failed', { error })
      
      // バリデーション失敗時は部分的に修正
      return {
        code: this.sanitizeCode(response.code),
        explanation: String(response.explanation).substring(0, 500) || '生成されたGASコード',
        steps: Array.isArray(response.steps) ? 
          response.steps.slice(0, 10).map(s => String(s).substring(0, 100)) :
          this.generateDefaultSteps()
      }
    }
  }

  /**
   * コードのサニタイゼーション（セキュリティ）
   */
  private static sanitizeCode(code: string): string {
    // 危険なパターンを検出・除去
    const dangerousPatterns = [
      /eval\s*\(/g,
      /Function\s*\(/g,
      /\.deleteSheet\s*\(/g,
      /UrlFetchApp\.fetch.*delete/gi
    ]

    let sanitized = code.trim()

    for (const pattern of dangerousPatterns) {
      if (pattern.test(sanitized)) {
        logger.warn('Dangerous pattern detected in generated code', { pattern: pattern.toString() })
        sanitized = sanitized.replace(pattern, '// REMOVED: Potentially dangerous code')
      }
    }

    // 最大文字数制限
    if (sanitized.length > 5000) {
      logger.warn('Generated code too long, truncating')
      sanitized = sanitized.substring(0, 5000) + '\n\n// ... コードが長すぎるため省略されました'
    }

    return sanitized
  }

  /**
   * フォールバックレスポンス作成
   */
  private static createFallbackResponse(rawContent: string): ClaudeCodeResponse {
    return {
      code: `// コード生成エラーが発生しました
function generationError() {
  Logger.log("申し訳ありません。コード生成中にエラーが発生しました。");
  Logger.log("もう一度詳しい要求を送信してください。");
}`,
      explanation: rawContent.substring(0, 200) || 'コード生成中にエラーが発生しました',
      steps: [
        'エラーが発生したため、もう一度お試しください',
        '要求内容をより詳しく説明してください',
        '問題が続く場合は管理者にお知らせください'
      ]
    }
  }

  /**
   * レスポンス品質評価
   */
  static evaluateResponseQuality(response: ClaudeCodeResponse): {
    score: number // 0-100
    issues: string[]
  } {
    const issues: string[] = []
    let score = 100

    // コードの基本チェック
    if (!response.code.includes('function')) {
      issues.push('Valid function definition missing')
      score -= 30
    }

    if (response.code.length < 50) {
      issues.push('Code seems too short')
      score -= 20
    }

    if (!response.code.includes('try') && !response.code.includes('catch')) {
      issues.push('Missing error handling')
      score -= 10
    }

    // 説明の品質チェック
    if (response.explanation.length < 20) {
      issues.push('Explanation too brief')
      score -= 15
    }

    // 手順の品質チェック
    if (response.steps.length < 3) {
      issues.push('Insufficient steps provided')
      score -= 10
    }

    return { score: Math.max(0, score), issues }
  }
}