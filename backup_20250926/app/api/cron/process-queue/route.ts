import { NextRequest, NextResponse } from 'next/server'
import { QueueProcessor } from '@/lib/queue/processor'
import { QueueManager } from '@/lib/queue/manager'
import { logger } from '@/lib/utils/logger'
import { MemoryMonitor } from '@/lib/utils/memory-monitor'
import EnvironmentValidator from '@/lib/config/environment'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 最大60秒

// グローバルインスタンスを作成（メモリリーク対策）
let processor: QueueProcessor | null = null

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 認証チェック（CRON_SECRETは必須、IPアドレス認証は削除）
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '') || req.headers.get('x-cron-secret')
    const expectedSecret = EnvironmentValidator.getRequired('CRON_SECRET')
    
    // セキュリティ: IPアドレス認証は偽装可能なため完全に削除
    // X-Forwarded-Forヘッダーは信頼できないため使用しない
    
    if (!cronSecret || cronSecret !== expectedSecret) {
      const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      const userAgent = req.headers.get('user-agent')
      
      logger.warn('Unauthorized cron access attempt', {
        clientIP,
        userAgent,
        hasSecret: !!cronSecret
      })
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    logger.info('Cron job triggered', {
      authorized: true
    })

    logger.info('Queue processing started')

    // メモリチェックとクリーンアップ
    MemoryMonitor.checkMemory()

    // シングルトンパターンでQueueProcessorを使って処理
    if (!processor) {
      processor = new QueueProcessor()
    }
    
    // まずキューにジョブがあるか確認（無駄な処理を避ける）
    const pendingJobs = await QueueManager.getPendingJobsCount()
    
    if (pendingJobs === 0) {
      // ジョブがない場合は早期リターン（コスト削減）
      return NextResponse.json({
        success: true,
        message: 'No jobs to process',
        processed: 0,
        errors: 0,
        remaining: 0,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      })
    }
    
    const result = await processor.startProcessing()
    
    logger.info('Queue processing completed', { 
      processed: result.processed,
      errors: result.errors,
      remaining: result.remaining
    })

    // メモリ使用量をログ
    const memUsage = process.memoryUsage()
    const heapUsageRatio = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
    if (heapUsageRatio > 80) {
      logger.warn('High memory usage after processing', {
        heapUsageRatio,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal
      })
    }

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
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    logger.error('Queue processing error:', {
      message: errorMessage,
      stack: errorStack,
      error: error
    })
    
    return NextResponse.json(
      { 
        error: 'Internal error',
        // 本番環境ではエラーの詳細を露出しない
        message: process.env.NODE_ENV === 'production' ? 'An error occurred' : errorMessage
      },
      { status: 500 }
    )
  }
}
