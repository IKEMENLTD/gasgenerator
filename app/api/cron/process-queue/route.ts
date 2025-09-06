import { NextRequest, NextResponse } from 'next/server'
import { QueueProcessor } from '@/lib/queue/processor'
import { QueueQueries } from '@/lib/supabase/queries'
import { logger } from '@/lib/utils/logger'

export const runtime = 'edge'
export const maxDuration = 60 // 最大60秒

export async function GET(req: NextRequest) {
  const startTime = Date.now()
  
  try {
    // 認証チェック（Render/Vercelのcron認証）
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
    const expectedSecret = process.env.CRON_SECRET
    
    // 開発環境では認証スキップ
    if (process.env.NODE_ENV === 'production' && expectedSecret && cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    logger.info('Queue processing started')

    // 保留中のジョブを取得
    const jobs = await QueueQueries.getNextJobs(5) // 最大5ジョブ
    
    if (jobs.length === 0) {
      logger.info('No pending jobs found')
      return NextResponse.json({
        success: true,
        message: 'No pending jobs',
        timestamp: new Date().toISOString()
      })
    }

    logger.info(`Processing ${jobs.length} jobs`)

    // 各ジョブを処理
    const results = []
    for (const job of jobs) {
      try {
        // ジョブを処理中にマーク
        await QueueQueries.markJobProcessing(job.id)
        
        // 実際のコード生成処理
        const processor = new QueueProcessor()
        const result = await processor.processJob(job)
        
        if (result.success) {
          await QueueQueries.markJobCompleted(job.id)
          results.push({ jobId: job.id, status: 'completed' })
        } else {
          await QueueQueries.markJobFailed(job.id, result.error || 'Unknown error')
          results.push({ jobId: job.id, status: 'failed', error: result.error })
        }
      } catch (error) {
        logger.error('Job processing failed', { jobId: job.id, error })
        await QueueQueries.markJobFailed(job.id, error instanceof Error ? error.message : 'Processing error')
        results.push({ jobId: job.id, status: 'error', error: String(error) })
      }
    }

    const processingTime = Date.now() - startTime
    logger.info('Queue processing completed', { 
      jobsProcessed: results.length,
      processingTime,
      results 
    })

    return NextResponse.json({
      success: true,
      message: 'Queue processing completed',
      jobsProcessed: results.length,
      results,
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
