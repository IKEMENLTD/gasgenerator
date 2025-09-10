import { logger } from '@/lib/utils/logger'
import { performanceMonitor } from '@/lib/monitoring/performance'
import { supabase } from '@/lib/supabase/client'
import { SecureRandom } from '@/lib/utils/secure-random'

interface ScheduledTask {
  id: string
  name: string
  type: 'once' | 'recurring' | 'cron'
  schedule?: string // cron表現
  interval?: number // ミリ秒
  nextRun: Date
  lastRun?: Date
  handler: () => Promise<void>
  enabled: boolean
  retryOnFailure: boolean
  maxRetries: number
  metadata?: Record<string, any>
}

interface TaskExecution {
  taskId: string
  startTime: Date
  endTime?: Date
  status: 'running' | 'completed' | 'failed'
  error?: string
  retryCount: number
}

export class TaskScheduler {
  private static instance: TaskScheduler | null = null
  private tasks: Map<string, ScheduledTask> = new Map()
  private executions: Map<string, TaskExecution> = new Map()
  private timers: Map<string, NodeJS.Timeout> = new Map()
  private isRunning = false
  private checkInterval?: NodeJS.Timeout

  private constructor() {
    this.loadTasks()
  }

  static getInstance(): TaskScheduler {
    if (!this.instance) {
      this.instance = new TaskScheduler()
    }
    return this.instance
  }

  /**
   * スケジューラーの開始
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Task scheduler already running')
      return
    }

    this.isRunning = true
    logger.info('Task scheduler started')

    // 1分ごとにタスクをチェック
    this.checkInterval = setInterval(() => {
      this.checkAndRunTasks()
    }, 60000)

    // 即座に最初のチェック
    this.checkAndRunTasks()
  }

  /**
   * スケジューラーの停止
   */
  stop(): void {
    this.isRunning = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = undefined
    }

    // すべてのタイマーをクリア
    for (const timer of this.timers.values()) {
      clearTimeout(timer)
    }
    this.timers.clear()

    logger.info('Task scheduler stopped')
  }

  /**
   * タスクの登録
   */
  registerTask(task: Omit<ScheduledTask, 'id' | 'nextRun'>): string {
    const taskId = this.generateTaskId()
    const nextRun = this.calculateNextRun(task)

    const scheduledTask: ScheduledTask = {
      ...task,
      id: taskId,
      nextRun
    }

    this.tasks.set(taskId, scheduledTask)
    this.saveTask(scheduledTask)

    logger.info('Task registered', {
      taskId,
      name: task.name,
      type: task.type,
      nextRun
    })

    // 即座にスケジュール
    if (task.type === 'once' || task.type === 'recurring') {
      this.scheduleTask(scheduledTask)
    }

    return taskId
  }

  /**
   * タスクの削除
   */
  unregisterTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) {
      logger.warn('Task not found', { taskId })
      return
    }

    // タイマーのクリア
    const timer = this.timers.get(taskId)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(taskId)
    }

    this.tasks.delete(taskId)
    this.deleteTaskFromDB(taskId)

    logger.info('Task unregistered', {
      taskId,
      name: task.name
    })
  }

  /**
   * タスクの実行
   */
  private async executeTask(task: ScheduledTask): Promise<void> {
    const executionId = `exec_${task.id}_${Date.now()}`
    
    const execution: TaskExecution = {
      taskId: task.id,
      startTime: new Date(),
      status: 'running',
      retryCount: 0
    }

    this.executions.set(executionId, execution)

    performanceMonitor.startTimer(`task.${task.id}`)

    try {
      logger.info('Executing task', {
        taskId: task.id,
        name: task.name
      })

      await this.executeWithRetry(task, execution)

      execution.status = 'completed'
      execution.endTime = new Date()

      logger.info('Task completed', {
        taskId: task.id,
        name: task.name,
        duration: execution.endTime.getTime() - execution.startTime.getTime()
      })

      // 次回実行の更新
      task.lastRun = new Date()
      if (task.type === 'recurring' || task.type === 'cron') {
        task.nextRun = this.calculateNextRun(task)
        this.saveTask(task)
        
        if (task.type === 'recurring') {
          this.scheduleTask(task)
        }
      }

    } catch (error) {
      execution.status = 'failed'
      execution.endTime = new Date()
      execution.error = error instanceof Error ? error.message : String(error)

      logger.error('Task failed', {
        taskId: task.id,
        name: task.name,
        error: execution.error
      })
    } finally {
      performanceMonitor.endTimer(`task.${task.id}`, {
        status: execution.status
      })

      // 実行履歴の保存
      this.saveExecution(execution)
    }
  }

  /**
   * リトライ付き実行
   */
  private async executeWithRetry(
    task: ScheduledTask,
    execution: TaskExecution
  ): Promise<void> {
    let lastError: Error | null = null
    const maxAttempts = task.retryOnFailure ? task.maxRetries + 1 : 1

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await task.handler()
        return
      } catch (error) {
        lastError = error as Error
        execution.retryCount = attempt

        if (attempt < maxAttempts - 1) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          logger.warn('Task execution failed, retrying', {
            taskId: task.id,
            attempt: attempt + 1,
            delay
          })
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }

    if (lastError) {
      throw lastError
    }
  }

  /**
   * タスクのスケジューリング
   */
  private scheduleTask(task: ScheduledTask): void {
    const now = Date.now()
    const nextRunTime = task.nextRun.getTime()
    const delay = Math.max(0, nextRunTime - now)

    const timer = setTimeout(() => {
      this.executeTask(task)
      this.timers.delete(task.id)
    }, delay)

    this.timers.set(task.id, timer)

    logger.debug('Task scheduled', {
      taskId: task.id,
      name: task.name,
      delay
    })
  }

  /**
   * タスクのチェックと実行
   */
  private checkAndRunTasks(): void {
    const now = new Date()

    for (const task of this.tasks.values()) {
      if (!task.enabled) continue
      
      // 実行中のタスクはスキップ
      const isRunning = Array.from(this.executions.values()).some(
        exec => exec.taskId === task.id && exec.status === 'running'
      )
      if (isRunning) continue

      // cronタスクのチェック
      if (task.type === 'cron' && task.nextRun <= now) {
        this.executeTask(task)
      }
    }
  }

  /**
   * 次回実行時刻の計算
   */
  private calculateNextRun(task: Partial<ScheduledTask>): Date {
    const now = new Date()

    if (task.type === 'once') {
      // 一度だけの実行
      return new Date(now.getTime() + (task.interval || 0))
    }

    if (task.type === 'recurring' && task.interval) {
      // 定期実行
      return new Date(now.getTime() + task.interval)
    }

    if (task.type === 'cron' && task.schedule) {
      // Cron式の解析（簡易実装）
      return this.parseCronExpression(task.schedule)
    }

    return now
  }

  /**
   * Cron式の解析（簡易実装）
   */
  private parseCronExpression(cronExpression: string): Date {
    // 実際のcronパーサーライブラリを使用すべき
    // ここでは簡易的に次の時刻を返す
    const parts = cronExpression.split(' ')
    const now = new Date()

    // 毎時実行の例: "0 * * * *"
    if (parts[0] === '0' && parts[1] === '*') {
      const nextHour = new Date(now)
      nextHour.setHours(now.getHours() + 1)
      nextHour.setMinutes(0)
      nextHour.setSeconds(0)
      return nextHour
    }

    // デフォルト: 1時間後
    return new Date(now.getTime() + 3600000)
  }

  /**
   * タスクの保存
   */
  private async saveTask(task: ScheduledTask): Promise<void> {
    // handlerを除外してDBに保存
    
    const { error } = await (supabase as any)
      .from('scheduled_tasks')
      .upsert({
        id: task.id,
        name: task.name,
        type: task.type,
        schedule: task.schedule,
        interval: task.interval,
        next_run: task.nextRun.toISOString(),
        last_run: task.lastRun?.toISOString(),
        enabled: task.enabled,
        retry_on_failure: task.retryOnFailure,
        max_retries: task.maxRetries,
        metadata: task.metadata
      })

    if (error) {
      logger.error('Failed to save task', { taskId: task.id, error })
    }
  }

  /**
   * 実行履歴の保存
   */
  private async saveExecution(execution: TaskExecution): Promise<void> {
    const { error } = await (supabase as any)
      .from('task_executions')
      .insert({
        task_id: execution.taskId,
        start_time: execution.startTime.toISOString(),
        end_time: execution.endTime?.toISOString(),
        status: execution.status,
        error: execution.error,
        retry_count: execution.retryCount
      })

    if (error) {
      logger.error('Failed to save execution', { error })
    }
  }

  /**
   * タスクの読み込み
   */
  private async loadTasks(): Promise<void> {
    const { data, error } = await supabase
      .from('scheduled_tasks')
      .select('*')
      .eq('enabled', true)

    if (error) {
      logger.error('Failed to load tasks', { error })
      return
    }

    // タスクの復元（ハンドラーは別途登録が必要）
    for (const taskData of data || []) {
      logger.info('Task loaded from database', {
        taskId: (taskData as any).id,
        name: (taskData as any).name
      })
    }
  }

  /**
   * タスクの削除（DB）
   */
  private async deleteTaskFromDB(taskId: string): Promise<void> {
    const { error } = await supabase
      .from('scheduled_tasks')
      .delete()
      .eq('id', taskId)

    if (error) {
      logger.error('Failed to delete task from DB', { taskId, error })
    }
  }

  /**
   * タスクIDの生成
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${SecureRandom.generateString(9)}`
  }

  /**
   * 統計情報の取得
   */
  async getStats(): Promise<{
    totalTasks: number
    enabledTasks: number
    runningTasks: number
    completedToday: number
    failedToday: number
  }> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const executions = Array.from(this.executions.values())
    const todayExecutions = executions.filter(
      exec => exec.startTime >= today
    )

    return {
      totalTasks: this.tasks.size,
      enabledTasks: Array.from(this.tasks.values()).filter(t => t.enabled).length,
      runningTasks: executions.filter(e => e.status === 'running').length,
      completedToday: todayExecutions.filter(e => e.status === 'completed').length,
      failedToday: todayExecutions.filter(e => e.status === 'failed').length
    }
  }

  /**
   * クリーンアップ
   */
  destroy(): void {
    this.stop()
    this.tasks.clear()
    this.executions.clear()
    TaskScheduler.instance = null
  }
}

// プリセットタスク
export const scheduledTasks = {
  // キューの処理（5分ごと）
  queueProcessor: {
    name: 'Queue Processor',
    type: 'recurring' as const,
    interval: 5 * 60 * 1000,
    handler: async () => {
      // キュー処理のロジック
      logger.info('Processing queue')
    },
    enabled: true,
    retryOnFailure: true,
    maxRetries: 3
  },

  // データベースバックアップ（毎日深夜2時）
  databaseBackup: {
    name: 'Database Backup',
    type: 'cron' as const,
    schedule: '0 2 * * *',
    handler: async () => {
      // バックアップのロジック
      logger.info('Running database backup')
    },
    enabled: true,
    retryOnFailure: true,
    maxRetries: 2
  },

  // ログクリーンアップ（毎週日曜日）
  logCleanup: {
    name: 'Log Cleanup',
    type: 'cron' as const,
    schedule: '0 0 * * 0',
    handler: async () => {
      // ログクリーンアップのロジック
      logger.info('Cleaning up old logs')
    },
    enabled: true,
    retryOnFailure: false,
    maxRetries: 0
  }
}

export const taskScheduler = TaskScheduler.getInstance()