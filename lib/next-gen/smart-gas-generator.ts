import { ClaudeApiClient } from '../claude/client'
import { AIRequirementsExtractor, ExtractedRequirements } from '../conversation/ai-requirements-extractor'
import { supabaseAdmin } from '../supabase/client'
import { logger } from '../utils/logger'

/**
 * 次世代のGASコード生成システム
 * 完全にLLM駆動で、人間の介入を最小限に
 */
export class SmartGASGenerator {
  private claudeClient = new ClaudeApiClient()

  /**
   * ワンショットで完璧なコードを生成
   */
  async generateFromConversation(
    userId: string,
    sessionId: string,
    messages: Array<{ role: string; content: string }>
  ): Promise<{
    code: string
    documentation: string
    testCases: string[]
    confidence: number
    warnings: string[]
  }> {
    try {
      // ステップ1: 要件を完全理解（構造化抽出）
      logger.info('Step 1: Extracting requirements with AI', { userId, sessionId })
      const requirements = await AIRequirementsExtractor.extractFromConversation(messages, userId)

      // ステップ2: 不足情報の確認
      const missingInfo = AIRequirementsExtractor.identifyMissingInfo(requirements)
      if (missingInfo.length > 0 && requirements.confidenceLevel < 60) {
        logger.warn('Missing critical information', { missingInfo, confidence: requirements.confidenceLevel })
        throw new Error(`要件が不明確です。以下を確認してください: ${missingInfo.join(', ')}`)
      }

      // ステップ3: コード生成（最大トークン使用）
      logger.info('Step 2: Generating optimized code', { userId, sessionId })
      const code = await this.generateOptimizedCode(requirements, sessionId)

      // ステップ4: コード品質チェック（別のLLMインスタンス）
      logger.info('Step 3: Quality check with AI', { userId, sessionId })
      const qualityCheck = await this.checkCodeQuality(code, requirements)

      // ステップ5: ドキュメント生成
      logger.info('Step 4: Generating documentation', { userId, sessionId })
      const documentation = await this.generateDocumentation(code, requirements)

      // ステップ6: テストケース生成
      logger.info('Step 5: Generating test cases', { userId, sessionId })
      const testCases = await this.generateTestCases(code, requirements)

      // ステップ7: 結果を保存
      await this.saveGenerationResult({
        userId,
        sessionId,
        requirements,
        code,
        documentation,
        testCases,
        qualityCheck
      })

      return {
        code,
        documentation,
        testCases,
        confidence: requirements.confidenceLevel,
        warnings: qualityCheck.warnings || []
      }

    } catch (error) {
      logger.error('Smart generation failed', { error, userId, sessionId })
      throw error
    }
  }

  /**
   * 最適化されたコード生成
   */
  private async generateOptimizedCode(
    requirements: ExtractedRequirements,
    _sessionId: string  // 将来的にログ用に使用予定
  ): Promise<string> {
    const prompt = `あなたは Google Apps Script のエキスパートです。
以下の要件を完全に満たすコードを生成してください。

要件:
- 主要目的: ${requirements.mainPurpose}
- データソース: ${requirements.dataSource || '未指定'}
- 処理タイプ: ${requirements.processingType || '未指定'}
- 出力形式: ${requirements.outputFormat || '未指定'}
- 実行タイミング: ${requirements.schedule || '手動実行'}
- 詳細要件: ${requirements.specificRequirements.join(', ')}
- 技術的制約: ${requirements.technicalConstraints?.join(', ') || 'なし'}

生成するコードの条件:
1. 完全に動作する実装（スタブやTODOは不可）
2. エラーハンドリング必須
3. 日本語コメントで処理を説明
4. 実行に必要な権限を冒頭にコメント
5. 必要な設定（シート名など）を定数化
6. パフォーマンスを考慮した実装

コードのみを出力してください。説明は不要です。`

    const response = await this.claudeClient.sendMessage(
      [{ role: 'user', content: prompt }],
      undefined,
      3,
      32000 // コード生成は最大トークン使用
    )

    // コードブロックを抽出
    const codeMatch = response.content[0].text.match(/```(?:javascript|js|gas)?\n([\s\S]*?)```/)
    return codeMatch ? codeMatch[1] : response.content[0].text
  }

  /**
   * AIによるコード品質チェック
   */
  private async checkCodeQuality(
    code: string,
    requirements: ExtractedRequirements
  ): Promise<{
    score: number
    issues: string[]
    warnings: string[]
    suggestions: string[]
  }> {
    const prompt = `以下のGASコードをレビューしてください。

コード:
\`\`\`javascript
${code}
\`\`\`

要件:
${JSON.stringify(requirements, null, 2)}

以下の観点でチェックし、JSON形式で結果を返してください：
{
  "score": 0-100の品質スコア,
  "issues": ["重大な問題のリスト"],
  "warnings": ["警告事項のリスト"],
  "suggestions": ["改善提案のリスト"]
}

チェック項目:
- セキュリティ（APIキーのハードコーディング等）
- パフォーマンス（無駄なループ、API呼び出し）
- エラーハンドリング
- 要件との一致度
- コードの保守性`

    const response = await this.claudeClient.sendMessage(
      [{ role: 'user', content: prompt }],
      undefined,
      3,
      5000
    )

    const jsonMatch = response.content[0].text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }

    return {
      score: 70,
      issues: [],
      warnings: ['品質チェックを完了できませんでした'],
      suggestions: []
    }
  }

  /**
   * ドキュメント生成
   */
  private async generateDocumentation(
    code: string,
    requirements: ExtractedRequirements
  ): Promise<string> {
    const prompt = `以下のGASコードのドキュメントを生成してください。

コード:
\`\`\`javascript
${code.substring(0, 3000)}...
\`\`\`

以下の形式で出力:
# 概要
# 必要な権限
# セットアップ手順
# 使用方法
# カスタマイズ方法
# トラブルシューティング`

    const response = await this.claudeClient.sendMessage(
      [{ role: 'user', content: prompt }],
      undefined,
      3,
      4000
    )

    return response.content[0].text
  }

  /**
   * テストケース生成
   */
  private async generateTestCases(
    code: string,
    requirements: ExtractedRequirements
  ): Promise<string[]> {
    const prompt = `以下のGASコードのテストケースを生成してください。

主要機能: ${requirements.mainPurpose}

3つの重要なテストケースを配列形式で返してください。
["テストケース1", "テストケース2", "テストケース3"]`

    const response = await this.claudeClient.sendMessage(
      [{ role: 'user', content: prompt }],
      undefined,
      3,
      1000
    )

    try {
      return JSON.parse(response.content[0].text)
    } catch {
      return ['基本動作テスト', 'エラーハンドリングテスト', '境界値テスト']
    }
  }

  /**
   * 生成結果の保存
   */
  private async saveGenerationResult(data: any): Promise<void> {
    try {
      // requirement_extractionsテーブルに保存
      await supabaseAdmin
        .from('requirement_extractions')
        .insert({
          session_id: data.sessionId,
          user_id: data.userId,
          conversation_messages: { messages: [] },
          extracted_requirements: data.requirements,
          confidence_level: data.requirements.confidenceLevel,
          extraction_method: 'smart-generator'
        })

      // コード品質チェック結果を保存
      if (data.qualityCheck) {
        await supabaseAdmin
          .from('code_quality_checks')
          .insert({
            check_type: 'comprehensive',
            issues: data.qualityCheck.issues || [],
            score: data.qualityCheck.score || 0,
            checked_by: 'claude-sonnet-4'
          })
      }

      logger.info('Generation result saved', { userId: data.userId, sessionId: data.sessionId })

    } catch (error) {
      logger.error('Failed to save generation result', { error })
    }
  }
}

// シングルトンインスタンス
export const smartGenerator = new SmartGASGenerator()