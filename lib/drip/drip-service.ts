/**
 * ドリップキャンペーン配信サービス
 *
 * 友だち追加後7日間、毎日1通ずつ面談CTA付きメッセージを配信。
 * ユーザーがBotにメッセージを送信/購入/面談予約した時点で即停止。
 */

import { supabaseAdmin } from '../supabase/client'
import { LineApiClient } from '../line/client'
import { getDripMessage, DRIP_TOTAL_STEPS } from './drip-messages'
import { logger } from '../utils/logger'

const lineClient = new LineApiClient()

// 配信時間帯（JST）: 10:00〜18:00
const SEND_HOUR_START = 10
const SEND_HOUR_END = 18
const JST_OFFSET_HOURS = 9

interface DripUser {
  id: string
  line_user_id: string
  followed_at: string
  drip_step: number
  drip_active: boolean
}

/**
 * 現在がJSTの配信時間帯内かチェック
 */
export function isWithinSendingHours(): boolean {
  const now = new Date()
  const jstHour = (now.getUTCHours() + JST_OFFSET_HOURS) % 24
  return jstHour >= SEND_HOUR_START && jstHour < SEND_HOUR_END
}

/**
 * ユーザーが次のステップを受け取るべきタイミングか判定
 * followed_at + step日数 が現在時刻を過ぎているかチェック
 */
function shouldSendNextStep(followedAt: string, currentStep: number): boolean {
  const followDate = new Date(followedAt)
  const nextStepDate = new Date(followDate)
  nextStepDate.setDate(nextStepDate.getDate() + currentStep)
  return new Date() >= nextStepDate
}

/**
 * ドリップ配信を開始（フォローイベント時に呼ぶ）
 */
export async function startDrip(lineUserId: string): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('users')
      .update({
        followed_at: new Date().toISOString(),
        drip_step: 0,
        drip_active: true,
        drip_stopped_reason: null,
      })
      .eq('line_user_id', lineUserId)

    logger.info('Drip campaign started', { lineUserId })
  } catch (error) {
    logger.error('Failed to start drip campaign', { lineUserId, error })
  }
}

/**
 * ドリップ配信を停止
 */
export async function stopDrip(lineUserId: string, reason: string): Promise<void> {
  try {
    await (supabaseAdmin as any)
      .from('users')
      .update({
        drip_active: false,
        drip_stopped_reason: reason,
      })
      .eq('line_user_id', lineUserId)

    logger.info('Drip campaign stopped', { lineUserId, reason })
  } catch (error) {
    logger.error('Failed to stop drip campaign', { lineUserId, reason, error })
  }
}

/**
 * ユーザーがBotにメッセージを送った時に呼ぶ（停止条件チェック）
 */
export async function checkAndStopDripOnUserAction(lineUserId: string): Promise<void> {
  try {
    const { data: user } = await (supabaseAdmin as any)
      .from('users')
      .select('drip_active')
      .eq('line_user_id', lineUserId)
      .single()

    if (user?.drip_active) {
      await stopDrip(lineUserId, 'user_messaged')
    }
  } catch (error) {
    // ドリップ停止の失敗は致命的ではないのでログだけ
    logger.error('Failed to check drip stop condition', { lineUserId, error })
  }
}

/**
 * 単一ユーザーへのドリップメッセージ送信
 */
async function sendDripToUser(user: DripUser): Promise<boolean> {
  const nextStep = user.drip_step + 1

  if (nextStep > DRIP_TOTAL_STEPS) {
    await stopDrip(user.line_user_id, 'completed')
    return false
  }

  const messages = getDripMessage(nextStep)
  if (!messages) {
    logger.error('No drip message found for step', { step: nextStep })
    return false
  }

  try {
    // メッセージ送信
    for (const msg of messages) {
      const success = await lineClient.pushMessage(
        user.line_user_id,
        [msg.content]
      )
      if (!success) {
        throw new Error(`Failed to push drip message step ${nextStep}`)
      }
    }

    // ステップを更新
    await (supabaseAdmin as any)
      .from('users')
      .update({
        drip_step: nextStep,
        drip_active: nextStep < DRIP_TOTAL_STEPS,
        drip_stopped_reason: nextStep >= DRIP_TOTAL_STEPS ? 'completed' : null,
      })
      .eq('line_user_id', user.line_user_id)

    // ログ記録
    await (supabaseAdmin as any)
      .from('drip_logs')
      .insert({
        user_id: user.id,
        line_user_id: user.line_user_id,
        step: nextStep,
        message_type: `day${nextStep}`,
        success: true,
      })

    logger.info('Drip message sent', {
      lineUserId: user.line_user_id,
      step: nextStep,
    })

    return true
  } catch (error) {
    // 送信失敗をログ記録（ブロックされた場合など）
    await (supabaseAdmin as any)
      .from('drip_logs')
      .insert({
        user_id: user.id,
        line_user_id: user.line_user_id,
        step: nextStep,
        message_type: `day${nextStep}`,
        success: false,
        error_message: error instanceof Error ? error.message : String(error),
      })
      .catch(() => {}) // ログ保存失敗は無視

    // push失敗 = ブロックされた可能性大 → ドリップ停止
    await stopDrip(user.line_user_id, 'send_failed')

    logger.error('Failed to send drip message', {
      lineUserId: user.line_user_id,
      step: nextStep,
      error,
    })

    return false
  }
}

/**
 * ドリップ配信のメイン処理（Cronジョブから呼ばれる）
 */
export async function processDripCampaign(): Promise<{
  processed: number
  sent: number
  skipped: number
  errors: number
}> {
  const result = { processed: 0, sent: 0, skipped: 0, errors: 0 }

  // 配信時間帯チェック
  if (!isWithinSendingHours()) {
    logger.info('Outside sending hours, skipping drip processing')
    return result
  }

  try {
    // ドリップ対象ユーザーを取得
    const { data: users, error } = await (supabaseAdmin as any)
      .from('users')
      .select('id, line_user_id, followed_at, drip_step, drip_active')
      .eq('drip_active', true)
      .not('followed_at', 'is', null)
      .order('followed_at', { ascending: true })
      .limit(50) // バッチサイズ制限（メモリ・API制限対策）

    if (error) {
      logger.error('Failed to fetch drip users', { error })
      return result
    }

    if (!users || users.length === 0) {
      logger.info('No active drip users found')
      return result
    }

    logger.info(`Processing drip for ${users.length} users`)

    for (const user of users as DripUser[]) {
      result.processed++

      // タイミングチェック
      if (!shouldSendNextStep(user.followed_at, user.drip_step + 1)) {
        result.skipped++
        continue
      }

      const sent = await sendDripToUser(user)
      if (sent) {
        result.sent++
      } else {
        result.errors++
      }

      // API制限対策: 送信間に200ms待機
      if (result.sent > 0) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }

    logger.info('Drip processing completed', result)
    return result
  } catch (error) {
    logger.error('Drip campaign processing failed', { error })
    return result
  }
}
