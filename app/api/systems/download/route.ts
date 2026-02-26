import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { getSpreadsheetUrl } from '@/lib/data/systems-data'
import { logger } from '@/lib/utils/logger'
import { checkAndRecordDownload } from '@/lib/download/download-limiter'

export const runtime = 'edge'

/**
 * セキュアダウンロードAPI
 * 署名付きURLを検証し、有料ユーザーのみスプレッドシートにリダイレクト
 *
 * GET /api/systems/download?id=01&u=BASE64(userId)&t=timestamp&s=signature
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const systemId = searchParams.get('id')
    const encodedUserId = searchParams.get('u')
    const timestamp = searchParams.get('t')
    const signature = searchParams.get('s')

    // パラメータ不足
    if (!systemId || !encodedUserId || !timestamp || !signature) {
      return NextResponse.redirect(new URL('/systems/catalog?error=missing_params', request.url))
    }

    // トークン有効期限チェック（24時間）
    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > 24 * 60 * 60 * 1000 || tokenAge < 0) {
      return NextResponse.redirect(new URL('/systems/catalog?error=expired', request.url))
    }

    // 署名検証
    const channelSecret = process.env.LINE_CHANNEL_SECRET
    if (!channelSecret) {
      logger.error('LINE_CHANNEL_SECRET not configured for download')
      return NextResponse.redirect(new URL('/systems/catalog?error=server_error', request.url))
    }

    const data = `${encodedUserId}:${timestamp}`
    const encoder = new TextEncoder()
    const keyData = encoder.encode(channelSecret)
    const messageData = encoder.encode(data)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // タイミング攻撃対策
    if (signature.length !== expectedSignature.length ||
        !timingSafeEqual(signature, expectedSignature)) {
      return NextResponse.redirect(new URL('/systems/catalog?error=invalid', request.url))
    }

    // ユーザーID復元
    const userId = atob(encodedUserId)

    // サブスクリプション確認
    const { data: user } = await (supabaseAdmin as any)
      .from('users')
      .select('subscription_status, subscription_end_date, free_download_used')
      .eq('line_user_id', userId)
      .maybeSingle()

    const now = new Date()
    const isPaid = user &&
      (user.subscription_status === 'premium' || user.subscription_status === 'professional') &&
      user.subscription_end_date &&
      new Date(user.subscription_end_date) > now

    // 無料ユーザー: 初回DL未使用ならfreeプランとして許可
    const isFreeEligible = !isPaid && user && user.free_download_used !== true

    if (!isPaid && !isFreeEligible) {
      return NextResponse.redirect(new URL('/systems/catalog?error=free_plan', request.url))
    }

    // スプレッドシートURL取得
    const spreadsheetUrl = getSpreadsheetUrl(systemId)
    if (!spreadsheetUrl) {
      return NextResponse.redirect(new URL(`/systems/catalog?error=not_ready&id=${systemId}`, request.url))
    }

    // ダウンロード回数チェック & 記録（freeプラン or 有料プラン）
    const dlStatus = isPaid ? user.subscription_status : 'free'
    const downloadCheck = await checkAndRecordDownload(userId, dlStatus, systemId, '')
    if (!downloadCheck.allowed) {
      const limitParam = `download_limit&plan=${user.subscription_status}&limit=${downloadCheck.limit}`
      return NextResponse.redirect(new URL(`/systems/catalog?error=${limitParam}`, request.url))
    }

    logger.info('Catalog download', { userId, systemId, remaining: downloadCheck.remaining })

    // スプレッドシートにリダイレクト
    return NextResponse.redirect(spreadsheetUrl)

  } catch (error) {
    logger.error('Download error', { error })
    return NextResponse.redirect(new URL('/systems/catalog?error=server_error', request.url))
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}
