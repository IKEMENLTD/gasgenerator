/**
 * エラー分析システム
 *
 * 🎯 目的: エラースクリーンショットからエラーを自動検出・分類
 * 📅 作成日: 2025-10-17
 */

import { ClaudeApiClient } from '../claude/client'
import { logger } from '../utils/logger'

export interface ErrorAnalysis {
  errorType: string              // エラータイプ (ReferenceError, TypeError等)
  errorMessage: string            // エラーメッセージ本文
  errorLocation?: {              // エラー発生箇所
    line?: number
    column?: number
    function?: string
  }
  errorContext: string            // エラーのコンテキスト（前後のコード）
  severity: 'low' | 'medium' | 'high' | 'critical'  // 深刻度
  suggestedFixes: string[]        // 推奨される修正方法
  relatedCode?: string            // 関連するコード部分
  confidence: number              // 分析の信頼度 (0-100)
}

export class ErrorAnalyzer {
  private claudeClient: ClaudeApiClient

  constructor() {
    this.claudeClient = new ClaudeApiClient()
  }

  /**
   * スクリーンショットからエラーを分析
   *
   * @param imageBase64 - Base64エンコードされた画像
   * @param originalCode - 元のコード（オプション）
   * @param userId - ユーザーID
   * @returns エラー分析結果
   */
  async analyzeErrorFromScreenshot(
    imageBase64: string,
    originalCode?: string,
    userId?: string
  ): Promise<ErrorAnalysis> {
    try {
      logger.info('Starting error analysis from screenshot', {
        userId,
        hasOriginalCode: !!originalCode
      })

      // Claude Vision APIでスクリーンショットを分析
      const analysisPrompt = this.buildAnalysisPrompt(originalCode)

      const response = await this.claudeClient.sendMessage([
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: imageBase64
              }
            },
            {
              type: 'text',
              text: analysisPrompt
            }
          ]
        }
      ], userId || 'system', 1, 4000)

      // レスポンスをパース
      const analysisResult = this.parseAnalysisResponse(response.content[0].text)

      logger.info('Error analysis completed', {
        userId,
        errorType: analysisResult.errorType,
        confidence: analysisResult.confidence
      })

      return analysisResult

    } catch (error) {
      logger.error('Error analysis failed', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      })

      // フォールバック: 基本的なエラー情報を返す
      return {
        errorType: 'UnknownError',
        errorMessage: '画像からエラーを検出できませんでした',
        errorContext: '',
        severity: 'medium',
        suggestedFixes: ['画像が不鮮明な可能性があります。もう一度スクリーンショットを送信してください'],
        confidence: 0
      }
    }
  }

  /**
   * テキストからエラーを分析（ユーザーがエラーメッセージをテキストで送信した場合）
   */
  async analyzeErrorFromText(
    errorText: string,
    originalCode?: string,
    userId?: string
  ): Promise<ErrorAnalysis> {
    try {
      logger.info('Starting error analysis from text', { userId })

      const analysisPrompt = `以下のエラーメッセージを分析してください：

${errorText}

${originalCode ? `\n元のコード:\n\`\`\`javascript\n${originalCode}\n\`\`\`` : ''}

以下のJSON形式で回答してください：
{
  "errorType": "エラータイプ（例: ReferenceError）",
  "errorMessage": "エラーメッセージ本文",
  "errorLocation": {"line": 行番号, "function": "関数名"},
  "errorContext": "エラーのコンテキスト説明",
  "severity": "low/medium/high/critical",
  "suggestedFixes": ["修正方法1", "修正方法2"],
  "confidence": 0-100の数値
}`

      const response = await this.claudeClient.sendMessage([{
        role: 'user',
        content: analysisPrompt
      }], userId || 'system', 1, 2000)

      return this.parseAnalysisResponse(response.content[0].text)

    } catch (error) {
      logger.error('Error analysis from text failed', { userId, error })

      return {
        errorType: 'UnknownError',
        errorMessage: errorText.substring(0, 200),
        errorContext: '',
        severity: 'medium',
        suggestedFixes: ['エラーの詳細を確認してください'],
        confidence: 30
      }
    }
  }

  /**
   * 分析プロンプトを構築
   */
  private buildAnalysisPrompt(originalCode?: string): string {
    return `この画像はGoogle Apps Scriptのエラー画面です。以下の情報を抽出してください：

1. エラータイプ（ReferenceError, TypeError, SyntaxError等）
2. エラーメッセージの全文
3. エラーが発生した行番号・関数名
4. エラーの深刻度（low/medium/high/critical）
5. 推奨される修正方法（3つ以内）

${originalCode ? `\n元のコード:\n\`\`\`javascript\n${originalCode.substring(0, 2000)}\n\`\`\`` : ''}

**必ずJSON形式で回答してください**：
\`\`\`json
{
  "errorType": "エラータイプ",
  "errorMessage": "エラーメッセージ全文",
  "errorLocation": {
    "line": 行番号（数値）,
    "function": "関数名"
  },
  "errorContext": "エラーの詳細な説明（日本語）",
  "severity": "low/medium/high/criticalのいずれか",
  "suggestedFixes": [
    "具体的な修正方法1",
    "具体的な修正方法2",
    "具体的な修正方法3"
  ],
  "relatedCode": "エラーに関連するコード部分",
  "confidence": 0-100の信頼度（数値）
}
\`\`\`

注意:
- 画像からエラー情報が読み取れない場合は、confidence を低めに設定
- suggestedFixes は具体的で実行可能なものを記載
- errorMessage は画像に表示されている正確なメッセージをコピー`
  }

  /**
   * Claude APIのレスポンスをパース
   */
  private parseAnalysisResponse(responseText: string): ErrorAnalysis {
    try {
      // JSONブロックを抽出
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        throw new Error('No JSON found in response')
      }

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      // バリデーション
      return {
        errorType: parsed.errorType || 'UnknownError',
        errorMessage: parsed.errorMessage || 'エラーメッセージを検出できませんでした',
        errorLocation: parsed.errorLocation,
        errorContext: parsed.errorContext || '',
        severity: this.validateSeverity(parsed.severity),
        suggestedFixes: Array.isArray(parsed.suggestedFixes) ? parsed.suggestedFixes : [],
        relatedCode: parsed.relatedCode,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 50
      }

    } catch (error) {
      logger.warn('Failed to parse error analysis response', {
        error: error instanceof Error ? error.message : String(error),
        responseText: responseText.substring(0, 500)
      })

      // フォールバック: テキストから基本情報を抽出
      return this.extractBasicErrorInfo(responseText)
    }
  }

  /**
   * 深刻度のバリデーション
   */
  private validateSeverity(severity: string): 'low' | 'medium' | 'high' | 'critical' {
    const validSeverities = ['low', 'medium', 'high', 'critical']
    return validSeverities.includes(severity) ? severity as any : 'medium'
  }

  /**
   * レスポンステキストから基本的なエラー情報を抽出（フォールバック）
   */
  private extractBasicErrorInfo(text: string): ErrorAnalysis {
    // エラータイプを検出
    const errorTypeMatch = text.match(/(ReferenceError|TypeError|SyntaxError|RangeError|Error)/i)
    const errorType = errorTypeMatch ? errorTypeMatch[1] : 'UnknownError'

    // エラーメッセージを検出
    const errorMessageMatch = text.match(/エラーメッセージ[:\s]+([^\n]+)/) ||
                             text.match(/message[:\s]+([^\n]+)/i)
    const errorMessage = errorMessageMatch ? errorMessageMatch[1].trim() : text.substring(0, 200)

    // 修正提案を検出
    const suggestedFixes: string[] = []
    const fixMatches = text.match(/修正方法\d+[:\s]+([^\n]+)/g)
    if (fixMatches) {
      fixMatches.forEach(match => {
        const fix = match.replace(/修正方法\d+[:\s]+/, '').trim()
        if (fix) suggestedFixes.push(fix)
      })
    }

    return {
      errorType,
      errorMessage,
      errorContext: text.substring(0, 500),
      severity: 'medium',
      suggestedFixes: suggestedFixes.length > 0 ? suggestedFixes : [
        'コードの構文を確認してください',
        '変数名のスペルミスがないか確認してください',
        '必要な権限が設定されているか確認してください'
      ],
      confidence: 40
    }
  }

  /**
   * エラーの深刻度を判定（追加のヒューリスティック）
   */
  determineSeverity(errorType: string, errorMessage: string): 'low' | 'medium' | 'high' | 'critical' {
    // クリティカルエラー
    if (errorType === 'SyntaxError' || errorMessage.includes('Unexpected token')) {
      return 'critical'
    }

    // 高優先度エラー
    if (errorType === 'ReferenceError' || errorType === 'TypeError') {
      return 'high'
    }

    // 中優先度エラー
    if (errorType === 'RangeError' || errorMessage.includes('undefined')) {
      return 'medium'
    }

    // 低優先度エラー
    return 'low'
  }
}
