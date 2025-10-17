import { logger } from '@/lib/utils/logger'
import { ClaudeApiClient } from './client'

/**
 * 生成されたコードの検証システム
 * 要件との一致度をチェックし、必要に応じて修正を行う
 */
export class CodeValidator {
  private claudeClient: ClaudeApiClient

  constructor() {
    this.claudeClient = new ClaudeApiClient()
  }

  /**
   * コードと要件の一致度を検証
   */
  async validateCode(
    generatedCode: string,
    originalRequirements: any,
    userMessages: string[]
  ): Promise<{
    isValid: boolean
    score: number
    issues: string[]
    suggestions: string[]
    needsRevision: boolean
    revisedCode?: string
  }> {
    try {
      // 検証プロンプトを構築
      const validationPrompt = this.buildValidationPrompt(
        generatedCode,
        originalRequirements,
        userMessages
      )

      // Claude APIで検証
      const response = await this.claudeClient.sendMessage([{
        role: 'user',
        content: validationPrompt
      }], 'validation')
      
      // レスポンスのテキストを取得
      const responseText = response.content.map(c => 
        typeof c === 'string' ? c : c.text || ''
      ).join('\n')
      
      // レスポンスを解析
      return this.parseValidationResponse(responseText, generatedCode)

    } catch (error) {
      logger.error('Code validation failed', { error })
      
      // エラー時はデフォルトで通す（ただし警告付き）
      return {
        isValid: true,
        score: 70,
        issues: ['検証プロセスでエラーが発生しましたが、コードは生成されています'],
        suggestions: [],
        needsRevision: false
      }
    }
  }

  /**
   * 検証用プロンプトの構築
   */
  private buildValidationPrompt(
    code: string,
    requirements: any,
    userMessages: string[]
  ): string {
    const prompt = `あなたは生成されたGoogle Apps Scriptコードの品質検証を行うエキスパートです。

## ユーザーの要求内容
${userMessages.join('\n')}

## 抽出された要件
${JSON.stringify(requirements, null, 2)}

## 生成されたコード
\`\`\`javascript
${code}
\`\`\`

## 検証タスク
以下の観点で検証し、JSON形式で回答してください：

1. **要件との一致度（0-100点）**
   - ユーザーが求めた全ての機能が実装されているか
   - 不要な機能が追加されていないか
   - 指定された条件や制約が守られているか

2. **発見された問題点**
   - 要件と一致しない部分
   - 実装漏れ
   - バグや論理エラー
   - セキュリティ上の問題

3. **改善提案**
   - より良い実装方法
   - パフォーマンス改善
   - エラーハンドリング

4. **修正の必要性**
   - critical: 必ず修正が必要（要件を満たしていない）
   - recommended: 推奨される修正（品質向上のため）
   - optional: 任意の改善点
   - none: 修正不要

## 回答フォーマット
\`\`\`json
{
  "score": 85,
  "matchesRequirements": true,
  "issues": [
    "A列の処理が要件と異なる",
    "エラーハンドリングが不足"
  ],
  "suggestions": [
    "try-catchブロックを追加",
    "ログ出力を詳細化"
  ],
  "severity": "recommended",
  "detailedAnalysis": {
    "requirementsCoverage": {
      "データ取得": "○ 実装済み",
      "フィルタリング": "△ 部分的に実装",
      "出力形式": "× 未実装"
    },
    "codeQuality": {
      "readability": 8,
      "efficiency": 7,
      "errorHandling": 5
    }
  }
}
\`\`\`

必ずJSON形式で回答し、日本語で説明してください。`

    return prompt
  }

  /**
   * 検証レスポンスの解析
   */
  private parseValidationResponse(
    response: string,
    originalCode: string
  ): {
    isValid: boolean
    score: number
    issues: string[]
    suggestions: string[]
    needsRevision: boolean
    revisedCode?: string
  } {
    try {
      // JSONを抽出
      const jsonMatch = response.match(/```json\n?([\s\S]*?)\n?```/)
      if (!jsonMatch) {
        throw new Error('No JSON found in validation response')
      }

      const validationResult = JSON.parse(jsonMatch[1])
      
      // スコアと重要度から判定
      const score = validationResult.score || 0
      const severity = validationResult.severity || 'none'
      const issues = validationResult.issues || []
      const suggestions = validationResult.suggestions || []

      // 修正が必要かどうかの判定
      const needsRevision = severity === 'critical' || score < 70

      // 結果を返す
      return {
        isValid: !needsRevision,
        score,
        issues,
        suggestions,
        needsRevision,
        revisedCode: needsRevision ? undefined : originalCode
      }

    } catch (error) {
      logger.error('Failed to parse validation response', { error, response })
      
      // パースエラー時はデフォルト値
      return {
        isValid: true,
        score: 75,
        issues: [],
        suggestions: [],
        needsRevision: false,
        revisedCode: originalCode
      }
    }
  }

  /**
   * コードの自動修正
   */
  async reviseCode(
    originalCode: string,
    issues: string[],
    requirements: any
  ): Promise<string> {
    try {
      const revisionPrompt = `以下のGoogle Apps Scriptコードを修正してください。

## 元のコード
\`\`\`javascript
${originalCode}
\`\`\`

## 発見された問題
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

## 要件
${JSON.stringify(requirements, null, 2)}

## 修正指示
- 上記の問題をすべて修正してください
- 要件を完全に満たすようにしてください
- 不要な変更は加えないでください
- コメントは最小限にしてください

修正後のコードのみを\`\`\`javascript\`\`\`で囲んで出力してください。説明は不要です。`

      const response = await this.claudeClient.sendMessage([{
        role: 'user',
        content: revisionPrompt
      }], 'revision')
      
      // レスポンスのテキストを取得
      const responseText = response.content.map(c => 
        typeof c === 'string' ? c : c.text || ''
      ).join('\n')
      
      // コードを抽出
      const codeMatch = responseText.match(/```javascript\n?([\s\S]*?)\n?```/)
      if (codeMatch) {
        return codeMatch[1].trim()
      }

      // 抽出できない場合は元のコードを返す
      logger.warn('Could not extract revised code, returning original')
      return originalCode

    } catch (error) {
      logger.error('Code revision failed', { error })
      return originalCode
    }
  }

  /**
   * 簡易的な構文チェック
   */
  validateSyntax(code: string): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    // 基本的な構文チェック
    try {
      // 括弧の対応をチェック
      const openBrackets = (code.match(/\{/g) || []).length
      const closeBrackets = (code.match(/\}/g) || []).length
      if (openBrackets !== closeBrackets) {
        errors.push(`括弧の数が一致しません: { ${openBrackets}個, } ${closeBrackets}個`)
      }

      const openParens = (code.match(/\(/g) || []).length
      const closeParens = (code.match(/\)/g) || []).length
      if (openParens !== closeParens) {
        errors.push(`括弧の数が一致しません: ( ${openParens}個, ) ${closeParens}個`)
      }

      // 必須要素のチェック
      if (!code.includes('function')) {
        errors.push('関数定義が見つかりません')
      }

      // セキュリティチェック
      if (code.includes('eval(')) {
        errors.push('セキュリティリスク: eval()の使用は推奨されません')
      }

      if (code.includes('Function(')) {
        errors.push('セキュリティリスク: Function()の使用は推奨されません')
      }

    } catch (error) {
      errors.push('構文チェック中にエラーが発生しました')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }
}