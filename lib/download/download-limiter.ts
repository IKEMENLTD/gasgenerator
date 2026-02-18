import { supabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

/** プラン別月間ダウンロード上限 */
const PLAN_LIMITS: Record<string, number> = {
  premium: 1,       // 1万円プラン: 月1回
  professional: 3,  // 5万円プラン: 月3回
}

interface DownloadInfo {
  remaining: number
  limit: number
  currentCount: number
}

interface DownloadCheckResult extends DownloadInfo {
  allowed: boolean
}

/** 現在の年月を "YYYY-MM" 形式で取得 */
function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7)
}

/**
 * ダウンロード残回数を取得（読み取り専用）
 * catalog-auth API等で使用
 */
export async function getDownloadInfo(
  lineUserId: string,
  subscriptionStatus: string
): Promise<DownloadInfo> {
  const limit = PLAN_LIMITS[subscriptionStatus] || 0
  if (limit === 0) {
    return { remaining: 0, limit: 0, currentCount: 0 }
  }

  const { data: user } = await (supabaseAdmin as any)
    .from('users')
    .select('monthly_download_count, download_reset_month')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  const currentMonth = getCurrentMonth()
  let currentCount = user?.monthly_download_count || 0

  // 月が変わっていたらカウントリセット（DB更新はcheckAndRecord時に行う）
  if (user?.download_reset_month !== currentMonth) {
    currentCount = 0
  }

  return {
    remaining: Math.max(0, limit - currentCount),
    limit,
    currentCount,
  }
}

/**
 * ダウンロード可否をチェックし、可能なら回数を記録
 * download/route.ts と webhook/route.ts で使用
 */
export async function checkAndRecordDownload(
  lineUserId: string,
  subscriptionStatus: string,
  systemId: string,
  systemName: string
): Promise<DownloadCheckResult> {
  const limit = PLAN_LIMITS[subscriptionStatus] || 0
  if (limit === 0) {
    return { allowed: false, remaining: 0, limit: 0, currentCount: 0 }
  }

  const { data: user } = await (supabaseAdmin as any)
    .from('users')
    .select('monthly_download_count, download_reset_month')
    .eq('line_user_id', lineUserId)
    .maybeSingle()

  const currentMonth = getCurrentMonth()
  let currentCount = user?.monthly_download_count || 0

  // 月が変わっていたらリセット
  if (user?.download_reset_month !== currentMonth) {
    currentCount = 0
  }

  // 上限チェック
  if (currentCount >= limit) {
    return {
      allowed: false,
      remaining: 0,
      limit,
      currentCount,
    }
  }

  // ダウンロード記録: カウント+1 & 月更新
  const newCount = currentCount + 1
  const { error: updateError } = await (supabaseAdmin as any)
    .from('users')
    .update({
      monthly_download_count: newCount,
      download_reset_month: currentMonth,
    })
    .eq('line_user_id', lineUserId)

  if (updateError) {
    logger.error('Failed to update download count', { lineUserId, error: updateError })
  } else {
    logger.info('Download recorded', {
      lineUserId,
      systemId,
      systemName,
      count: newCount,
      limit,
      month: currentMonth,
    })
  }

  return {
    allowed: true,
    remaining: Math.max(0, limit - newCount),
    limit,
    currentCount: newCount,
  }
}

/** プランのダウンロード上限を取得 */
export function getDownloadLimit(subscriptionStatus: string): number {
  return PLAN_LIMITS[subscriptionStatus] || 0
}
