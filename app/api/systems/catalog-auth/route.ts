import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'
import { getDownloadInfo } from '@/lib/download/download-limiter'

export const runtime = 'edge'

/**
 * カタログページの認証API
 * 署名付きURLからユーザーのサブスクリプション状態を返す
 *
 * GET /api/systems/catalog-auth?u=BASE64(userId)&t=timestamp&s=signature
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const encodedUserId = searchParams.get('u')
    const timestamp = searchParams.get('t')
    const signature = searchParams.get('s')

    // パラメータ不足
    if (!encodedUserId || !timestamp || !signature) {
      return NextResponse.json({ authenticated: false, reason: 'missing_params' })
    }

    // トークン有効期限チェック（24時間）
    const tokenAge = Date.now() - parseInt(timestamp, 10)
    if (isNaN(tokenAge) || tokenAge > 24 * 60 * 60 * 1000 || tokenAge < 0) {
      return NextResponse.json({ authenticated: false, reason: 'expired' })
    }

    // 署名検証
    const channelSecret = process.env.LINE_CHANNEL_SECRET
    if (!channelSecret) {
      logger.error('LINE_CHANNEL_SECRET not configured')
      return NextResponse.json({ authenticated: false, reason: 'server_error' })
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
    if (signature.length !== expectedSignature.length) {
      return NextResponse.json({ authenticated: false, reason: 'invalid_signature' })
    }
    let diff = 0
    for (let i = 0; i < signature.length; i++) {
      diff |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
    }
    if (diff !== 0) {
      return NextResponse.json({ authenticated: false, reason: 'invalid_signature' })
    }

    // ユーザーID復元
    const userId = atob(encodedUserId)

    // Supabase でサブスクリプション確認
    const { data: user } = await (supabaseAdmin as any)
      .from('users')
      .select('subscription_status, subscription_end_date, monthly_usage_count')
      .eq('line_user_id', userId)
      .maybeSingle()

    if (!user) {
      return NextResponse.json({ authenticated: true, isPaid: false, planName: '無料プラン' })
    }

    const now = new Date()
    const isPaid = (user.subscription_status === 'premium' || user.subscription_status === 'professional') &&
      user.subscription_end_date &&
      new Date(user.subscription_end_date) > now

    // 有料ユーザーの場合、ダウンロード残回数を取得
    let downloadsRemaining = 0
    let downloadsLimit = 0
    if (isPaid) {
      const dlInfo = await getDownloadInfo(userId, user.subscription_status)
      downloadsRemaining = dlInfo.remaining
      downloadsLimit = dlInfo.limit
    }

    return NextResponse.json({
      authenticated: true,
      isPaid,
      planName: isPaid
        ? (user.subscription_status === 'professional' ? 'プロフェッショナルプラン' : 'プレミアムプラン')
        : '無料プラン',
      downloadsRemaining,
      downloadsLimit,
    })

  } catch (error) {
    logger.error('Catalog auth error', { error })
    return NextResponse.json({ authenticated: false, reason: 'server_error' })
  }
}
