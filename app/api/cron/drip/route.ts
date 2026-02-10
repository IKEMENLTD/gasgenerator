import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import { processDripCampaign } from '@/lib/drip/drip-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * ドリップキャンペーン配信Cronエンドポイント
 *
 * 1時間ごとに外部Cronサービスから呼び出される想定。
 * JST 10:00〜18:00の間のみ実際に配信を行う。
 *
 * 認証: Authorization: Bearer <CRON_SECRET> or x-cron-secret ヘッダー
 */
export async function GET(req: NextRequest) {
  try {
    // 認証チェック
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
      || req.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET

    if (!expectedSecret || !cronSecret || cronSecret !== expectedSecret) {
      logger.warn('Unauthorized drip cron access attempt', {
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    const result = await processDripCampaign()
    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      ...result,
      processingTime: `${processingTime}ms`,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Drip cron error', {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
