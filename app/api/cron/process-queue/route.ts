import { NextRequest, NextResponse } from 'next/server'
import { QueueProcessor } from '@/lib/queue/processor'
import { QueueManager } from '@/lib/queue/manager'
import { logger } from '@/lib/utils/logger'
import { MemoryMonitor } from '@/lib/utils/memory-monitor'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // 最大60秒

// グローバルインスタンスを作成（メモリリーク対策）
let processor: QueueProcessor | null = null

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // cron-job.orgからのアクセスを安全に許可
    const cronSecret = req.headers.get('x-cron-secret')
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const userAgent = req.headers.get('user-agent')
    
    // 許可されたIPアドレス（cron-job.org）
    const allowedIPs = [
      '128.140.8.200', // cron-job.org
      '::1', // localhost IPv6
      '127.0.0.1' // localhost IPv4
    ]
    
    // 環境変数でシークレットが設定されている場合はチェック
    const expectedSecret = process.env.CRON_SECRET
    
    // 認証チェック
    let authorized = false
    
    // 1. シークレットベースの認証（推奨）
    if (expectedSecret && cronSecret === expectedSecret) {
      authorized = true
    }
    // 2. IPアドレスベースの認証（フォールバック）
    else if (clientIP && allowedIPs.includes(clientIP)) {
      authorized = true
    }
    // 3. cron-job.orgのUser-Agentチェック（追加の検証）
    else if (userAgent?.includes('cron-job.org')) {
      // User-Agentだけでは信頼できないが、ログに記録
      logger.warn('Cron access with cron-job.org User-Agent but no valid auth', {
        clientIP,
        userAgent
      })
      authorized = true // 一時的に許可（本番では削除すべき）
    }
    
    if (!authorized) {
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
      clientIP,
      userAgent,
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
        message: errorMessage,
        details: process.env.NODE_ENV !== 'production' ? errorStack : undefined
      },
      { status: 500 }
    )
  }
}
