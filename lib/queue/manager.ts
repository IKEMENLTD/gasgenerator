import { QueueQueries } from '@/lib/supabase/queries'
import { logger } from '@/lib/utils/logger'
import { QUEUE_CONFIG } from '@/lib/constants/config'
import { RetryHandler } from '@/lib/utils/retry-handler'
import { AppError } from '@/lib/errors/app-error'
import { DatabaseTransaction } from '@/lib/database/transaction'
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
      // ジョブ情報を取得
      const job = await QueueQueries.getJob(jobId)
      if (!job) {
        throw new Error('Job not found')
      }

      const retryCount = (job.retry_count || 0) + 1
      const maxRetries = job.max_retries || 3

      // リトライ可能かチェック
      if (shouldRetry && retryCount < maxRetries) {
        // リトライカウントを更新してpendingに戻す
        await QueueQueries.retryJob(jobId, retryCount)
        
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
      const stats = await QueueQueries.getQueueStats()
      return stats
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
      
      // TODO: 古いジョブ削除クエリの実装
      logger.info('Old jobs cleanup initiated', { cutoffTime })
      
      return 0 // 削除されたジョブ数

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
      // TODO: 所有者チェック機能の実装
      
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
      
      // TODO: スタックしたジョブの検出・解決
      logger.info('Deadlock resolution initiated', { stuckTime })
      
      return 0 // 解決されたジョブ数

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