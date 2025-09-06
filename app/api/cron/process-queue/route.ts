import { NextRequest, NextResponse } from 'next/server'
import { QueueProcessor } from '@/lib/queue/processor'
import { QueueManager } from '@/lib/queue/manager'
import { logger } from '@/lib/utils/logger'

export const runtime = 'edge'
export const maxDuration = 60 // 最大60秒

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // cron-job.orgからのアクセスを許可
    // 注: セキュリティのため、本番環境では適切な認証を設定してください
    
    // オプション: 特定のIPからのみ許可する場合
    // const allowedIPs = ['cron-job.orgのIP']
    // const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
    
    // 現在は認証なしで許可（cron-job.orgが動作するように）
    logger.info('Cron job triggered', {
      headers: {
        'user-agent': req.headers.get('user-agent'),
        'x-forwarded-for': req.headers.get('x-forwarded-for')
      }
    })

    logger.info('Queue processing started')

    // QueueProcessorを使って処理
    const processor = new QueueProcessor()
    const result = await processor.startProcessing()
    
    logger.info('Queue processing completed', { 
      processed: result.processed,
      errors: result.errors,
      remaining: result.remaining
    })

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Queue processing completed',
      processed: result.processed,
      errors: result.errors,
      remaining: result.remaining,
      processingTime,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    logger.error('Queue processing error:', error)
    return NextResponse.json(
      { 
        error: 'Internal error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
