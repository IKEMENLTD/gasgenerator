/**
 * エラー自動修復システム
 *
 * 🎯 目的: エラーパターンから自動的にコードを修正
 * 📅 作成日: 2025-10-17
 * 🎲 成功率目標: 85%
 */

import { ClaudeApiClient } from '../claude/client'
import { logger } from '../utils/logger'
import { supabaseAdmin } from '../supabase/client'
import type { ErrorAnalysis } from './error-analyzer'

export interface FixResult {
  success: boolean
  fixedCode?: string
  fixMethod: 'auto' | 'pattern' | 'ai' | 'manual'
  confidence: number              // 修正の信頼度 (0-100)
  explanation: string             // 修正内容の説明
  changesApplied: string[]        // 適用した変更のリスト
  patternUsed?: number            // 使用したパターンID
  estimatedSuccessRate: number    // 推定成功率 (0-100)
}

export class AutoFixer {
  private claudeClient: ClaudeApiClient

  constructor() {
    this.claudeClient = new ClaudeApiClient()
  }

  /**
   * エラーを自動修復
   *
   * @param originalCode - 元のコード
   * @param errorAnalysis - エラー分析結果
   * @param userId - ユーザーID
   * @param attemptCount - 修正試行回数
   * @returns 修正結果
   */
  async fixError(
    originalCode: string,
    errorAnalysis: ErrorAnalysis,
    userId: string,
    attemptCount: number = 0
  ): Promise<FixResult> {
    try {
      logger.info('Starting automatic error fix', {
        userId,
        errorType: errorAnalysis.errorType,
        attemptCount
      })

      // 1. パターンマッチングを試みる（最速）
      const patternFix = await this.tryPatternMatch(errorAnalysis, originalCode)
      if (patternFix && patternFix.confidence > 70) {
        logger.info('Pattern match successful', {
          userId,
          patternId: patternFix.patternUsed,
          confidence: patternFix.confidence
        })
        return patternFix
      }

      // 2. AI修正を試みる（Claude）
      const aiFix = await this.tryAIFix(originalCode, errorAnalysis, userId, attemptCount)
      if (aiFix && aiFix.confidence > 60) {
        logger.info('AI fix successful', {
          userId,
          confidence: aiFix.confidence
        })
        return aiFix
      }

      // 3. 基本的な修正を試みる（ヒューリスティック）
      const basicFix = await this.tryBasicFix(originalCode, errorAnalysis)
      if (basicFix) {
        logger.info('Basic fix applied', {
          userId,
          confidence: basicFix.confidence
        })
        return basicFix
      }

      // 4. 全て失敗した場合
      logger.warn('All fix attempts failed', { userId, attemptCount })
      return {
        success: false,
        fixMethod: 'manual',
        confidence: 0,
        explanation: '自動修正できませんでした。エンジニアに相談してください。',
        changesApplied: [],
        estimatedSuccessRate: 0
      }

    } catch (error) {
      logger.error('Error fixing failed', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        fixMethod: 'manual',
        confidence: 0,
        explanation: '修正処理中にエラーが発生しました',
        changesApplied: [],
        estimatedSuccessRate: 0
      }
    }
  }

  /**
   * パターンマッチングで修正を試みる
   */
  private async tryPatternMatch(
    errorAnalysis: ErrorAnalysis,
    originalCode: string
  ): Promise<FixResult | null> {
    try {
      // データベースから類似エラーパターンを検索
      const { data: patterns, error } = await supabaseAdmin
        .from('error_patterns')
        .select('*')
        .eq('error_type', errorAnalysis.errorType)
        .order('success_rate', { ascending: false })
        .order('usage_count', { ascending: false })
        .limit(5)

      if (error || !patterns || patterns.length === 0) {
        logger.debug('No matching patterns found', {
          errorType: errorAnalysis.errorType
        })
        return null
      }

      // 最も成功率の高いパターンを適用
      for (const pattern of patterns) {
        const fixedCode = this.applyPattern(originalCode, pattern, errorAnalysis)

        if (fixedCode && fixedCode !== originalCode) {
          // パターンの使用回数を更新
          await this.updatePatternUsage(pattern.id)

          return {
            success: true,
            fixedCode,
            fixMethod: 'pattern',
            confidence: pattern.success_rate,
            explanation: `過去の成功パターンを適用しました（成功率 ${pattern.success_rate}%）`,
            changesApplied: [pattern.solution_pattern],
            patternUsed: pattern.id,
            estimatedSuccessRate: pattern.success_rate
          }
        }
      }

      return null

    } catch (error) {
      logger.warn('Pattern matching failed', { error })
      return null
    }
  }

  /**
   * AIを使用して修正
   */
  private async tryAIFix(
    originalCode: string,
    errorAnalysis: ErrorAnalysis,
    userId: string,
    attemptCount: number
  ): Promise<FixResult | null> {
    try {
      const fixPrompt = this.buildFixPrompt(originalCode, errorAnalysis, attemptCount)

      const response = await this.claudeClient.sendMessage([{
        role: 'user',
        content: fixPrompt
      }], userId, 1, 8000)

      const fixResult = this.parseFixResponse(response.content[0].text, originalCode)

      if (fixResult && fixResult.fixedCode) {
        return {
          success: true,
          ...fixResult,
          fixMethod: 'ai',
          estimatedSuccessRate: 75 // AIの平均成功率
        }
      }

      return null

    } catch (error) {
      logger.warn('AI fix failed', { error })
      return null
    }
  }

  /**
   * 基本的な修正を試みる（ヒューリスティック）
   */
  private async tryBasicFix(
    originalCode: string,
    errorAnalysis: ErrorAnalysis
  ): Promise<FixResult | null> {
    const changes: string[] = []
    let fixedCode = originalCode

    // ReferenceError: 未定義の変数
    if (errorAnalysis.errorType === 'ReferenceError') {
      const match = errorAnalysis.errorMessage.match(/(\w+) is not defined/)
      if (match) {
        const varName = match[1]
        // 変数宣言を追加
        fixedCode = `var ${varName} = null; // 追加: 未定義変数の初期化\n${fixedCode}`
        changes.push(`変数 ${varName} を初期化しました`)
      }
    }

    // SyntaxError: カンマ忘れ等
    if (errorAnalysis.errorType === 'SyntaxError') {
      // 基本的な構文修正（限定的）
      if (errorAnalysis.errorMessage.includes('Unexpected token')) {
        // これは複雑なので基本修正では対応しない
        return null
      }
    }

    // TypeError: nullやundefinedへのアクセス
    if (errorAnalysis.errorType === 'TypeError') {
      // null チェックの追加
      fixedCode = fixedCode.replace(
        /([a-zA-Z_$][a-zA-Z0-9_$]*)\.([\w]+)/g,
        (match, obj, prop) => {
          if (!match.includes('if') && !match.includes('null')) {
            changes.push(`${obj} への null チェックを追加`)
            return `(${obj} ? ${obj}.${prop} : null)`
          }
          return match
        }
      )
    }

    if (changes.length > 0 && fixedCode !== originalCode) {
      return {
        success: true,
        fixedCode,
        fixMethod: 'auto',
        confidence: 50,
        explanation: '基本的な修正を適用しました',
        changesApplied: changes,
        estimatedSuccessRate: 50
      }
    }

    return null
  }

  /**
   * パターンを適用
   */
  private applyPattern(
    code: string,
    pattern: any,
    errorAnalysis: ErrorAnalysis
  ): string | null {
    try {
      // solution_pattern に基づいてコードを変換
      // 例: "Add var declaration at line X" → コードに var を追加

      const solution = pattern.solution_pattern.toLowerCase()

      // 変数宣言の追加
      if (solution.includes('add var') || solution.includes('declare variable')) {
        const varMatch = errorAnalysis.errorMessage.match(/(\w+) is not defined/)
        if (varMatch) {
          return `var ${varMatch[1]} = null;\n${code}`
        }
      }

      // 関数の修正
      if (solution.includes('fix function') && errorAnalysis.errorLocation?.function) {
        // 関数を探して修正（簡易版）
        return code // TODO: 実装
      }

      // null チェックの追加
      if (solution.includes('null check') || solution.includes('add check')) {
        return code.replace(
          /([a-zA-Z_$][a-zA-Z0-9_$]*)\.([\w]+)/g,
          (_match, obj, prop) => `(${obj} ? ${obj}.${prop} : null)`
        )
      }

      return null

    } catch (error) {
      logger.warn('Failed to apply pattern', { error })
      return null
    }
  }

  /**
   * 修正プロンプトを構築
   */
  private buildFixPrompt(
    originalCode: string,
    errorAnalysis: ErrorAnalysis,
    attemptCount: number
  ): string {
    return `以下のGoogle Apps Scriptコードにエラーがあります。修正してください。

【エラー情報】
- エラータイプ: ${errorAnalysis.errorType}
- エラーメッセージ: ${errorAnalysis.errorMessage}
${errorAnalysis.errorLocation ? `- 発生箇所: 行 ${errorAnalysis.errorLocation.line}` : ''}
- 深刻度: ${errorAnalysis.severity}

【元のコード】
\`\`\`javascript
${originalCode}
\`\`\`

【推奨される修正方法】
${errorAnalysis.suggestedFixes.map((fix, i) => `${i + 1}. ${fix}`).join('\n')}

${attemptCount > 0 ? `\n注意: これは${attemptCount + 1}回目の修正試行です。前回の修正では解決しませんでした。` : ''}

以下のJSON形式で回答してください：
\`\`\`json
{
  "fixedCode": "修正後のコード全体",
  "confidence": 0-100の信頼度（数値）,
  "explanation": "修正内容の日本語説明",
  "changesApplied": ["変更1", "変更2", ...]
}
\`\`\`

重要な注意:
- コード全体を必ず含めてください（一部だけでなく全体）
- 元のコードの意図を保持してください
- Google Apps Scriptの文法に従ってください
- コメントで修正箇所を明示してください`
  }

  /**
   * 修正レスポンスをパース
   */
  private parseFixResponse(responseText: string, originalCode: string): {
    fixedCode: string
    confidence: number
    explanation: string
    changesApplied: string[]
  } | null {
    try {
      // JSONブロックを抽出
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/```\s*([\s\S]*?)\s*```/) ||
                       responseText.match(/\{[\s\S]*\}/)

      if (!jsonMatch) {
        // コードブロックを直接抽出
        const codeMatch = responseText.match(/```javascript\s*([\s\S]*?)\s*```/)
        if (codeMatch) {
          return {
            fixedCode: codeMatch[1].trim(),
            confidence: 60,
            explanation: '修正を適用しました',
            changesApplied: ['コードを修正しました']
          }
        }
        return null
      }

      const jsonText = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonText)

      if (!parsed.fixedCode || parsed.fixedCode === originalCode) {
        return null
      }

      return {
        fixedCode: parsed.fixedCode,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 60,
        explanation: parsed.explanation || '修正を適用しました',
        changesApplied: Array.isArray(parsed.changesApplied) ? parsed.changesApplied : []
      }

    } catch (error) {
      logger.warn('Failed to parse fix response', { error })
      return null
    }
  }

  /**
   * パターンの使用回数を更新
   */
  private async updatePatternUsage(patternId: number): Promise<void> {
    try {
      await supabaseAdmin
        .from('error_patterns')
        .update({
          usage_count: supabaseAdmin.raw('usage_count + 1'),
          last_used_at: new Date().toISOString()
        })
        .eq('id', patternId)

    } catch (error) {
      logger.warn('Failed to update pattern usage', { patternId, error })
    }
  }

  /**
   * 修正の成功/失敗をフィードバック（パターンの成功率を更新）
   */
  async provideFeedback(
    patternId: number | undefined,
    isSuccessful: boolean
  ): Promise<void> {
    if (!patternId) return

    try {
      // 現在の統計を取得
      const { data: pattern } = await supabaseAdmin
        .from('error_patterns')
        .select('success_rate, usage_count')
        .eq('id', patternId)
        .single()

      if (!pattern) return

      // 成功率を更新（移動平均）
      const currentSuccesses = (pattern.success_rate * pattern.usage_count) / 100
      const newSuccesses = currentSuccesses + (isSuccessful ? 1 : 0)
      const newSuccessRate = (newSuccesses / pattern.usage_count) * 100

      await supabaseAdmin
        .from('error_patterns')
        .update({ success_rate: newSuccessRate })
        .eq('id', patternId)

      logger.info('Pattern feedback recorded', {
        patternId,
        isSuccessful,
        newSuccessRate
      })

    } catch (error) {
      logger.warn('Failed to provide feedback', { patternId, error })
    }
  }
}
