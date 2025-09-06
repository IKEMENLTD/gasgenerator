import { logger } from '@/lib/utils/logger'

interface PerformanceMetric {
  name: string
  duration: number
  timestamp: number
  metadata?: Record<string, any>
}

interface AggregatedMetrics {
  count: number
  total: number
  average: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor | null = null
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private timers: Map<string, number> = new Map()
  private slowThresholds: Map<string, number> = new Map()
  private alertCallback?: (metric: PerformanceMetric) => void

  private readonly MAX_METRICS_PER_KEY = 1000
  private readonly CLEANUP_INTERVAL = 60000 // 1分
  private cleanupTimer?: NodeJS.Timeout

  private constructor() {
    this.initializeThresholds()
    this.startCleanup()
  }

  static getInstance(): PerformanceMonitor {
    if (!this.instance) {
      this.instance = new PerformanceMonitor()
    }
    return this.instance
  }

  /**
   * 閾値の初期化
   */
  private initializeThresholds(): void {
    this.slowThresholds.set('api.webhook', 3000) // 3秒
    this.slowThresholds.set('api.cron', 10000) // 10秒
    this.slowThresholds.set('db.query', 1000) // 1秒
    this.slowThresholds.set('claude.api', 30000) // 30秒
    this.slowThresholds.set('line.api', 5000) // 5秒
    this.slowThresholds.set('queue.processing', 60000) // 1分
  }

  /**
   * 計測開始
   */
  startTimer(name: string): void {
    this.timers.set(name, Date.now())
  }

  /**
   * 計測終了
   */
  endTimer(name: string, metadata?: Record<string, any>): number {
    const startTime = this.timers.get(name)
    if (!startTime) {
      logger.warn('Timer not found', { name })
      return 0
    }

    const duration = Date.now() - startTime
    this.timers.delete(name)

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: Date.now(),
      metadata
    }

    this.recordMetric(metric)
    this.checkSlowOperation(metric)

    return duration
  }

  /**
   * メトリクスの記録
   */
  private recordMetric(metric: PerformanceMetric): void {
    const metrics = this.metrics.get(metric.name) || []
    
    metrics.push(metric)
    
    // サイズ制限
    if (metrics.length > this.MAX_METRICS_PER_KEY) {
      metrics.shift()
    }

    this.metrics.set(metric.name, metrics)
  }

  /**
   * 遅い処理のチェック
   */
  private checkSlowOperation(metric: PerformanceMetric): void {
    const threshold = this.getThreshold(metric.name)
    
    if (metric.duration > threshold) {
      logger.warn('Slow operation detected', {
        name: metric.name,
        duration: metric.duration,
        threshold,
        metadata: metric.metadata
      })

      // アラートコールバックの実行
      if (this.alertCallback) {
        this.alertCallback(metric)
      }
    }
  }

  /**
   * 閾値の取得
   */
  private getThreshold(name: string): number {
    // 完全一致
    if (this.slowThresholds.has(name)) {
      return this.slowThresholds.get(name)!
    }

    // プレフィックスマッチ
    for (const [key, threshold] of this.slowThresholds.entries()) {
      if (name.startsWith(key)) {
        return threshold
      }
    }

    // デフォルト
    return 5000
  }

  /**
   * メトリクスの集計
   */
  getAggregatedMetrics(name: string, timeWindow?: number): AggregatedMetrics | null {
    const metrics = this.metrics.get(name)
    if (!metrics || metrics.length === 0) {
      return null
    }

    const now = Date.now()
    const filteredMetrics = timeWindow
      ? metrics.filter(m => now - m.timestamp <= timeWindow)
      : metrics

    if (filteredMetrics.length === 0) {
      return null
    }

    const durations = filteredMetrics.map(m => m.duration).sort((a, b) => a - b)
    const total = durations.reduce((sum, d) => sum + d, 0)

    return {
      count: durations.length,
      total,
      average: total / durations.length,
      min: durations[0],
      max: durations[durations.length - 1],
      p50: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99)
    }
  }

  /**
   * パーセンタイル計算
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil((sorted.length * p) / 100) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  /**
   * レポート生成
   */
  generateReport(): Record<string, AggregatedMetrics> {
    const report: Record<string, AggregatedMetrics> = {}

    for (const name of this.metrics.keys()) {
      const aggregated = this.getAggregatedMetrics(name)
      if (aggregated) {
        report[name] = aggregated
      }
    }

    return report
  }

  /**
   * 定期クリーンアップ
   */
  private startCleanup(): void {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      const maxAge = 3600000 // 1時間

      for (const [name, metrics] of this.metrics.entries()) {
        const filtered = metrics.filter(m => now - m.timestamp <= maxAge)
        if (filtered.length === 0) {
          this.metrics.delete(name)
        } else if (filtered.length < metrics.length) {
          this.metrics.set(name, filtered)
        }
      }
    }, this.CLEANUP_INTERVAL)
  }

  /**
   * アラート設定
   */
  setAlertCallback(callback: (metric: PerformanceMetric) => void): void {
    this.alertCallback = callback
  }

  /**
   * 閾値の更新
   */
  setThreshold(name: string, threshold: number): void {
    this.slowThresholds.set(name, threshold)
  }

  /**
   * リソースクリーンアップ
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    this.metrics.clear()
    this.timers.clear()
    PerformanceMonitor.instance = null
  }
}

// グローバルインスタンス
export const performanceMonitor = PerformanceMonitor.getInstance()

/**
 * パフォーマンス計測デコレータ
 */
export function measurePerformance(name?: string) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    const metricName = name || `${target.constructor.name}.${propertyKey}`

    descriptor.value = async function (...args: any[]) {
      performanceMonitor.startTimer(metricName)
      try {
        const result = await originalMethod.apply(this, args)
        performanceMonitor.endTimer(metricName, { success: true })
        return result
      } catch (error) {
        performanceMonitor.endTimer(metricName, { 
          success: false,
          error: error instanceof Error ? error.message : String(error)
        })
        throw error
      }
    }

    return descriptor
  }
}