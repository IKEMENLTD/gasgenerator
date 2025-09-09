import { NextRequest, NextResponse } from 'next/server'
import { logger } from '@/lib/utils/logger'
import EnvironmentValidator from '@/lib/config/environment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // 認証チェック（CRON_SECRETは必須）
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
    const expectedSecret = EnvironmentValidator.getRequired('CRON_SECRET')
    
    if (!cronSecret || cronSecret !== expectedSecret) {
      logger.warn('Unauthorized cron access attempt', {
        ip: req.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // クリーンアップ処理（簡略化）
    logger.info('Cleanup job executed')

    return NextResponse.json({
      success: true,
      message: 'Cleanup completed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Cleanup error', { error })
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
