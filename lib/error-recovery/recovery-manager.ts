/**
 * エラー修復マネージャー（統合システム）
 *
 * 🎯 目的: エラー検出→分析→修復→フィードバックの全プロセスを管理
 * 📅 作成日: 2025-10-17
 */

import { ErrorAnalyzer, type ErrorAnalysis } from './error-analyzer'
import { AutoFixer, type FixResult } from './auto-fixer'
import { ExperienceSystem } from '../gamification/experience-system'
import { supabaseAdmin } from '../supabase/client'
import { logger } from '../utils/logger'
import { LineApiClient } from '../line/client'
import { engineerSupport } from '../line/engineer-support'

export interface RecoverySession {
  userId: string
  sessionId: string
  originalCode: string
  errorScreenshotBase64?: string
  attemptCount: number
  isResolved: boolean
  recoveryLogId?: number
}

export class RecoveryManager {
  private errorAnalyzer: ErrorAnalyzer
  private autoFixer: AutoFixer
  private lineClient: LineApiClient

  constructor() {
    this.errorAnalyzer = new ErrorAnalyzer()
    this.autoFixer = new AutoFixer()
    this.lineClient = new LineApiClient()
  }

  /**
   * エラー修復プロセスを開始
   *
   * @param userId - ユーザーID
   * @param sessionId - セッションID
   * @param originalCode - 元のコード
   * @param errorScreenshotBase64 - エラースクリーンショット（Base64）
   * @param attemptCount - 試行回数
   * @returns 修復結果
   */
  async startRecovery(
    userId: string,
    sessionId: string,
    originalCode: string,
    errorScreenshotBase64?: string,
    attemptCount: number = 0
  ): Promise<{
    success: boolean
    fixedCode?: string
    message: string
    shouldEscalate: boolean
    recoveryLogId?: number
  }> {
    try {
      logger.info('Starting error recovery', {
        userId,
        sessionId,
        attemptCount,
        hasScreenshot: !!errorScreenshotBase64
      })

      // 1. 進捗メッセージ送信（ユーザーに状況を伝える）
      await this.sendProgressMessage(userId, attemptCount, 'analyzing')

      // 2. エラーを分析
      let errorAnalysis: ErrorAnalysis

      if (errorScreenshotBase64) {
        errorAnalysis = await this.errorAnalyzer.analyzeErrorFromScreenshot(
          errorScreenshotBase64,
          originalCode,
          userId
        )
      } else {
        // スクリーンショットがない場合は、デフォルトの分析
        errorAnalysis = {
          errorType: 'UnknownError',
          errorMessage: 'エラー情報が不足しています',
          errorContext: '',
          severity: 'medium',
          suggestedFixes: ['エラー画面のスクリーンショットを送信してください'],
          confidence: 20
        }
      }

      logger.info('Error analysis completed', {
        userId,
        errorType: errorAnalysis.errorType,
        confidence: errorAnalysis.confidence
      })

      // 3. 修復ログを作成
      const { data: recoveryLog } = await supabaseAdmin
        .from('error_recovery_logs')
        .insert({
          user_id: userId,
          session_id: sessionId,
          original_code: originalCode,
          error_screenshot_url: errorScreenshotBase64 ? 'inline_base64' : null,
          error_analysis: errorAnalysis,
          detected_error_type: errorAnalysis.errorType,
          detected_error_message: errorAnalysis.errorMessage,
          fix_attempt_count: attemptCount
        })
        .select('id')
        .single()

      const recoveryLogId = recoveryLog?.id

      // 4. 進捗メッセージ更新
      await this.sendProgressMessage(userId, attemptCount, 'fixing')

      // 5. 自動修復を試みる
      const fixResult = await this.autoFixer.fixError(
        originalCode,
        errorAnalysis,
        userId,
        attemptCount
      )

      logger.info('Fix attempt completed', {
        userId,
        success: fixResult.success,
        confidence: fixResult.confidence,
        fixMethod: fixResult.fixMethod
      })

      // 6. 修復ログを更新
      if (recoveryLogId) {
        await supabaseAdmin
          .from('error_recovery_logs')
          .update({
            fixed_code: fixResult.fixedCode,
            fix_method: fixResult.fixMethod,
            pattern_id: fixResult.patternUsed,
            is_successful: fixResult.success,
            resolved_at: fixResult.success ? new Date().toISOString() : null
          })
          .eq('id', recoveryLogId)
      }

      // 7. エスカレーション判定（3回失敗したら）
      const shouldEscalate = attemptCount >= 2 && !fixResult.success

      if (shouldEscalate) {
        logger.warn('Error recovery failed, escalating to engineer', {
          userId,
          attemptCount
        })

        // エンジニアに自動エスカレーション
        await this.escalateToEngineer(userId, errorAnalysis, originalCode, attemptCount)

        return {
          success: false,
          message: '自動修正が困難なため、エンジニアに引き継ぎました。24時間以内に対応します。',
          shouldEscalate: true,
          recoveryLogId
        }
      }

      // 8. 結果をユーザーに送信
      if (fixResult.success && fixResult.fixedCode) {
        // 成功時: XP付与
        const xpReward = await ExperienceSystem.awardXP(
          userId,
          fixResult.fixMethod === 'auto' || fixResult.fixMethod === 'pattern'
            ? ExperienceSystem.XP_REWARDS.ERROR_FIXED_AUTO
            : ExperienceSystem.XP_REWARDS.ERROR_FIXED_MANUAL,
          `エラー修正成功（${fixResult.fixMethod}）`,
          'error_fixed'
        )

        // 成功メッセージを送信
        await this.sendSuccessMessage(userId, fixResult, xpReward, attemptCount)

        return {
          success: true,
          fixedCode: fixResult.fixedCode,
          message: '修正に成功しました！',
          shouldEscalate: false,
          recoveryLogId
        }
      } else {
        // 失敗時: リトライを促す
        await this.sendRetryMessage(userId, errorAnalysis, attemptCount)

        return {
          success: false,
          message: '自動修正に失敗しました。別の方法を試してください。',
          shouldEscalate: false,
          recoveryLogId
        }
      }

    } catch (error) {
      logger.error('Recovery process failed', {
        userId,
        error: error instanceof Error ? error.message : String(error)
      })

      return {
        success: false,
        message: 'エラー修復処理中に問題が発生しました',
        shouldEscalate: false,
        recoveryLogId: undefined
      }
    }
  }

  /**
   * 進捗メッセージを送信
   */
  private async sendProgressMessage(
    userId: string,
    attemptCount: number,
    phase: 'analyzing' | 'fixing'
  ): Promise<void> {
    const messages: { [key: string]: string } = {
      'analyzing': `🔍 エラーを分析中です...${attemptCount > 0 ? `（${attemptCount + 1}回目の試行）` : ''}`,
      'fixing': '🔧 自動修復を実行中です...'
    }

    try {
      await this.lineClient.pushMessage(userId, [{
        type: 'text',
        text: messages[phase]
      }])
    } catch (error) {
      logger.warn('Failed to send progress message', { userId, error })
    }
  }

  /**
   * 成功メッセージを送信（ゲーミフィケーション含む）
   */
  private async sendSuccessMessage(
    userId: string,
    fixResult: FixResult,
    xpReward: any,
    _attemptCount: number
  ): Promise<void> {
    try {
      let message = `✅ エラー修正に成功しました！\n\n`

      // 修正内容
      message += `【修正内容】\n${fixResult.explanation}\n\n`

      // 変更点
      if (fixResult.changesApplied.length > 0) {
        message += `【適用した変更】\n`
        fixResult.changesApplied.forEach((change, i) => {
          message += `${i + 1}. ${change}\n`
        })
        message += `\n`
      }

      // ゲーミフィケーション
      message += `【報酬】\n`
      message += `🌟 +${xpReward.amount} XP 獲得！\n`

      if (xpReward.levelUp) {
        message += `🎉 レベルアップ! Lv.${xpReward.newLevel}\n`
      }

      if (xpReward.badgesUnlocked.length > 0) {
        message += `\n【バッジ獲得】\n`
        xpReward.badgesUnlocked.forEach((badge: any) => {
          message += `${badge.icon} ${badge.name}\n`
        })
      }

      // 修正後のコード
      message += `\n【修正後のコード】\n\`\`\`\n${fixResult.fixedCode?.substring(0, 800)}\n`
      if (fixResult.fixedCode && fixResult.fixedCode.length > 800) {
        message += `...(省略)...\n`
      }
      message += `\`\`\``

      await this.lineClient.pushMessage(userId, [{
        type: 'text',
        text: message,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '✅ 動作確認OK', text: '動作しました' }},
            { type: 'action', action: { type: 'message', label: '❌ まだエラー', text: 'まだエラーが出ます' }},
            { type: 'action', action: { type: 'message', label: '📊 統計を見る', text: 'マイステータス' }},
            { type: 'action', action: { type: 'message', label: '🔄 別のコード', text: '新しいコードを作りたい' }}
          ]
        }
      }])

    } catch (error) {
      logger.warn('Failed to send success message', { userId, error })
    }
  }

  /**
   * リトライメッセージを送信
   */
  private async sendRetryMessage(
    userId: string,
    errorAnalysis: ErrorAnalysis,
    attemptCount: number
  ): Promise<void> {
    try {
      let message = `❌ 自動修正に失敗しました（${attemptCount + 1}回目）\n\n`

      message += `【エラー情報】\n`
      message += `- タイプ: ${errorAnalysis.errorType}\n`
      message += `- メッセージ: ${errorAnalysis.errorMessage.substring(0, 100)}\n\n`

      message += `【推奨される対処法】\n`
      errorAnalysis.suggestedFixes.slice(0, 3).forEach((fix, i) => {
        message += `${i + 1}. ${fix}\n`
      })

      message += `\n次の方法を試してください：`

      await this.lineClient.pushMessage(userId, [{
        type: 'text',
        text: message,
        quickReply: {
          items: [
            { type: 'action', action: { type: 'message', label: '📷 再度スクショ送信', text: 'エラーのスクショを送る' }},
            { type: 'action', action: { type: 'message', label: '👨‍💻 エンジニアに相談', text: 'エンジニアに相談する' }},
            { type: 'action', action: { type: 'message', label: '🔄 最初から', text: '最初から' }}
          ]
        }
      }])

    } catch (error) {
      logger.warn('Failed to send retry message', { userId, error })
    }
  }

  /**
   * エンジニアにエスカレーション
   */
  private async escalateToEngineer(
    userId: string,
    errorAnalysis: ErrorAnalysis,
    originalCode: string,
    attemptCount: number
  ): Promise<void> {
    try {
      // エスカレーションメッセージを作成
      const escalationMessage = `🚨 自動修正失敗 - エスカレーション\n\n` +
        `ユーザーID: ${userId}\n` +
        `試行回数: ${attemptCount + 1}回\n` +
        `エラータイプ: ${errorAnalysis.errorType}\n` +
        `エラーメッセージ: ${errorAnalysis.errorMessage}\n\n` +
        `元のコード:\n\`\`\`\n${originalCode.substring(0, 500)}\n...\n\`\`\``

      // エンジニアサポートシステムに通知
      await engineerSupport.notifyEngineers(userId, escalationMessage)

      // ユーザーに通知
      await this.lineClient.pushMessage(userId, [{
        type: 'text',
        text: '🆘 エンジニアチームに引き継ぎました。\n\n24時間以内に対応いたします。\n少々お待ちください。'
      }])

      logger.info('Escalated to engineer', { userId, attemptCount })

    } catch (error) {
      logger.error('Failed to escalate to engineer', { userId, error })
    }
  }

  /**
   * 修復フィードバックを記録（ユーザーが「動作しました」「まだエラー」と返答）
   */
  async recordFeedback(
    userId: string,
    isSuccessful: boolean,
    recoveryLogId?: number
  ): Promise<void> {
    try {
      if (recoveryLogId) {
        await supabaseAdmin
          .from('error_recovery_logs')
          .update({
            is_successful: isSuccessful,
            user_feedback: isSuccessful ? 'success' : 'still_failing',
            resolved_at: isSuccessful ? new Date().toISOString() : null
          })
          .eq('id', recoveryLogId)
      }

      // パターンの成功率を更新（使用したパターンがある場合）
      const { data: log } = await supabaseAdmin
        .from('error_recovery_logs')
        .select('pattern_id')
        .eq('id', recoveryLogId)
        .single()

      if (log?.pattern_id) {
        await this.autoFixer.provideFeedback(log.pattern_id, isSuccessful)
      }

      logger.info('Feedback recorded', { userId, isSuccessful, recoveryLogId })

    } catch (error) {
      logger.warn('Failed to record feedback', { userId, error })
    }
  }
}
