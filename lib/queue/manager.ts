import { QueueQueries } from '@/lib/supabase/queries'
import { logger } from '@/lib/utils/logger'
import { QUEUE_CONFIG } from '@/lib/constants/config'
import { RetryHandler } from '@/lib/utils/retry-handler'
import { AppError } from '@/lib/errors/app-error'
import type { QueueJob, QueueJobInsert } from '@/types/database'
import type { CodeGenerationRequest } from '@/types/claude'

export interface QueueAddOptions {
  priority?: number
  maxRetries?: number
}

export class QueueManager {
  /**
   * キューに新しいジョブを追加
   */
  static async addJob(
    request: CodeGenerationRequest,
    options: QueueAddOptions = {}
  ): Promise<QueueJob> {
    return RetryHandler.execute(async () => {
      try {
        const jobData: QueueJobInsert = {
          user_id: request.userId,
          line_user_id: request.lineUserId,
          session_id: request.sessionId,
          requirements: {
            category: request.category,
            subcategory: request.subcategory,
            requirements: request.requirements,
            userHistory: request.userHistory
          },
          status: 'pending',
          priority: options.priority || 0,
          max_retries: options.maxRetries || QUEUE_CONFIG.MAX_CONCURRENT_JOBS
        }

        const job = await QueueQueries.addToQueue(jobData)

        logger.info('Job added to queue', {
          jobId: job.id,
          userId: request.userId,
          category: request.category,
          priority: job.priority
        })

        return job

      } catch (error) {
        logger.error('Failed to add job to queue', {
          userId: request.userId,
          error
        })
        throw AppError.databaseError('Queue job insertion', error)
      }
    }, {
      maxAttempts: 3,
      initialDelay: 1000
    })
  }

  /**
   * 次に処理すべきジョブを取得
   */
  static async getNextJobs(batchSize: number = QUEUE_CONFIG.BATCH_SIZE): Promise<QueueJob[]> {
    try {
      const jobs = await QueueQueries.getNextJobs(batchSize)
      
      logger.debug('Retrieved jobs from queue', {
        count: jobs.length,
        batchSize
      })

      return jobs

    } catch (error) {
      logger.error('Failed to get next jobs', { error })
      return []
    }
  }

  /**
   * 保留中のジョブ数を取得（コスト削減用）
   */
  static async getPendingJobsCount(): Promise<number> {
    try {
      const count = await QueueQueries.getPendingJobsCount()
      return count
    } catch (error) {
      logger.error('Failed to get pending jobs count', { error })
      return 0
    }
  }

  /**
   * ジョブを処理中状態にする
   */
  static async startProcessing(jobId: string): Promise<void> {
    try {
      await QueueQueries.markJobProcessing(jobId)
      
      logger.debug('Job marked as processing', { jobId })

    } catch (error) {
      logger.error('Failed to mark job as processing', { jobId, error })
      throw error
    }
  }

  /**
   * ジョブを完了状態にする
   */
  static async completeJob(jobId: string): Promise<void> {
    try {
      await QueueQueries.markJobCompleted(jobId)
      
      logger.info('Job completed', { jobId })

    } catch (error) {
      logger.error('Failed to complete job', { jobId, error })
      throw error
    }
  }

  /**
   * ジョブを失敗状態にする（リトライ考慮）
   */
  static async failJob(jobId: string, errorMessage: string, shouldRetry: boolean = true): Promise<void> {
    try {
      // ジョブ情報を取得（直接Supabaseクエリ）
      const { supabaseAdmin } = await import('@/lib/supabase/client')
      const { data: job, error: fetchError } = await supabaseAdmin
        .from('generation_queue')
        .select('*')
        .eq('id', jobId)
        .single()
      
      if (fetchError || !job) {
        throw new Error('Job not found')
      }

      const retryCount = ((job as any).retry_count || 0) + 1
      const maxRetries = (job as any).max_retries || 3

      // リトライ可能かチェック
      if (shouldRetry && retryCount < maxRetries) {
        // リトライカウントを更新してpendingに戻す
        await QueueQueries.updateJobStatus(jobId, {
          status: 'pending',
          retry_count: retryCount
        } as any)
        
        logger.warn('Job marked for retry', { 
          jobId, 
          retryCount,
          maxRetries,
          errorMessage 
        })
      } else {
        // 最終的に失敗
        await QueueQueries.markJobFailed(jobId, errorMessage)
        
        logger.error('Job permanently failed', { 
          jobId, 
          errorMessage,
          retryCount 
        })
      }

    } catch (error) {
      logger.error('Failed to handle job failure', { jobId, error })
      throw error
    }
  }

  /**
   * キューの統計情報取得
   */
  static async getQueueStats(): Promise<{
    pending: number
    processing: number
    completed: number
    failed: number
    totalToday: number
  }> {
    try {
      // 直接Supabaseクエリで統計を取得
      const { supabaseAdmin } = await import('@/lib/supabase/client')
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const [pending, processing, completed, failed, totalToday] = await Promise.all([
        supabaseAdmin.from('generation_queue').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabaseAdmin.from('generation_queue').select('*', { count: 'exact', head: true }).eq('status', 'processing'),
        supabaseAdmin.from('generation_queue').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabaseAdmin.from('generation_queue').select('*', { count: 'exact', head: true }).eq('status', 'failed'),
        supabaseAdmin.from('generation_queue').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString())
      ])
      
      return {
        pending: pending.count || 0,
        processing: processing.count || 0,
        completed: completed.count || 0,
        failed: failed.count || 0,
        totalToday: totalToday.count || 0
      }
    } catch (error) {
      logger.error('Failed to get queue stats', { error })
      return {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalToday: 0
      }
    }
  }

  /**
   * 古いジョブのクリーンアップ
   */
  static async cleanupOldJobs(): Promise<number> {
    try {
      const cutoffTime = new Date(Date.now() - QUEUE_CONFIG.CLEANUP_INTERVAL_MS)
      
      // 古いジョブを削除
      const { supabaseAdmin } = await import('@/lib/supabase/client')
      const { data: oldJobs, error } = await supabaseAdmin
        .from('generation_queue')
        .delete()
        .or(`status.eq.completed,status.eq.failed`)
        .lt('created_at', cutoffTime.toISOString())
        .select('id')
      
      if (error) {
        logger.error('Failed to cleanup old jobs', { error })
        return 0
      }
      
      const deletedCount = oldJobs?.length || 0
      logger.info('Old jobs cleaned up', { cutoffTime, deletedCount })
      
      return deletedCount

    } catch (error) {
      logger.error('Job cleanup failed', { error })
      return 0
    }
  }

  /**
   * 優先度の動的調整
   */
  static async adjustPriority(jobId: string, newPriority: number): Promise<void> {
    try {
      await QueueQueries.updateJobStatus(jobId, { priority: newPriority })
      
      logger.info('Job priority adjusted', { jobId, newPriority })

    } catch (error) {
      logger.error('Failed to adjust job priority', { jobId, error })
      throw error
    }
  }

  /**
   * キュー容量チェック
   */
  static async checkCapacity(): Promise<{
    withinCapacity: boolean
    pendingJobs: number
    maxCapacity: number
  }> {
    try {
      const stats = await this.getQueueStats()
      const maxCapacity = 100 // 最大キュー容量
      
      return {
        withinCapacity: stats.pending < maxCapacity,
        pendingJobs: stats.pending,
        maxCapacity
      }

    } catch (error) {
      logger.error('Failed to check queue capacity', { error })
      return {
        withinCapacity: true,
        pendingJobs: 0,
        maxCapacity: 100
      }
    }
  }

  /**
   * ジョブの取り消し（ユーザーリクエスト）
   */
  static async cancelJob(jobId: string, userId: string): Promise<boolean> {
    try {
      // セキュリティ：ユーザーは自分のジョブのみ取り消し可能
      const { supabaseAdmin } = await import('@/lib/supabase/client')
      const { data: job, error: fetchError } = await supabaseAdmin
        .from('generation_queue')
        .select('user_id')
        .eq('id', jobId)
        .single()
      
      if (fetchError || !job) {
        logger.warn('Job not found for cancellation', { jobId, userId })
        return false
      }
      
      // 所有者チェック
      if ((job as any).user_id !== userId) {
        logger.warn('Unauthorized job cancellation attempt', { jobId, userId, ownerId: (job as any).user_id })
        return false
      }
      
      await QueueQueries.updateJobStatus(jobId, {
        status: 'failed',
        error_message: 'Cancelled by user'
      })

      logger.info('Job cancelled by user', { jobId, userId })
      return true

    } catch (error) {
      logger.error('Failed to cancel job', { jobId, userId, error })
      return false
    }
  }

  /**
   * デッドロック検出と解決
   */
  static async resolveDeadlocks(): Promise<number> {
    try {
      const stuckJobsThreshold = 5 * 60 * 1000 // 5分以上処理中のジョブ
      const stuckTime = new Date(Date.now() - stuckJobsThreshold)
      
      // スタックしたジョブを検出してリセット
      const { supabaseAdmin } = await import('@/lib/supabase/client')
      const { data: stuckJobs, error } = await (supabaseAdmin as any)
        .from('generation_queue')
        .update({
          status: 'pending',
          retry_count: 0,
          error_message: 'Reset due to processing timeout'
        })
        .eq('status', 'processing')
        .lt('processed_at', stuckTime.toISOString())
        .select('id')
      
      if (error) {
        logger.error('Failed to resolve deadlocks', { error })
        return 0
      }
      
      const resolvedCount = stuckJobs?.length || 0
      if (resolvedCount > 0) {
        logger.warn('Resolved deadlocked jobs', { stuckTime, resolvedCount, jobIds: stuckJobs?.map((j: any) => j.id) })
      }
      
      return resolvedCount

    } catch (error) {
      logger.error('Deadlock resolution failed', { error })
      return 0
    }
  }

  /**
   * バックプレッシャー制御
   */
  static async shouldAcceptNewJobs(): Promise<boolean> {
    try {
      const stats = await this.getQueueStats()
      
      // 保留中のジョブが多すぎる場合は新規受付を停止
      if (stats.pending > 50) {
        logger.warn('High queue load, rejecting new jobs', { pending: stats.pending })
        return false
      }

      // 失敗率が高い場合は一時的に受付停止
      const failureRate = stats.failed / Math.max(1, stats.totalToday)
      if (failureRate > 0.1) { // 10%以上の失敗率
        logger.warn('High failure rate, rejecting new jobs', { failureRate })
        return false
      }

      return true

    } catch (error) {
      logger.error('Failed to check job acceptance', { error })
      return true // エラー時は受け入れる（可用性を優先）
    }
  }
}