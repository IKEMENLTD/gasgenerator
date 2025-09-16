import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const maxDuration = 5

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  memory: {
    heapUsed: string
    heapTotal: string
    rss: string
    usage: string
    status: 'ok' | 'warning' | 'critical'
  }
  checks: {
    database: {
      status: 'ok' | 'error'
      latency?: number
      error?: string
    }
    lineApi: {
      status: 'ok' | 'error'
      error?: string
    }
    anthropicApi: {
      status: 'ok' | 'error'
      error?: string
    }
    environment: {
      status: 'ok' | 'error'
      missing?: string[]
    }
  }
}

const startTime = Date.now()

// グローバルメモリキャッシュの管理
declare global {
  var memoryCleanupCount: number
}

if (!global.memoryCleanupCount) {
  global.memoryCleanupCount = 0
}

export async function GET() {
  // ガベージコレクション強制実行（可能な場合）
  if (global.gc) {
    global.gc()
  }

  // メモリ使用状況を先にチェック
  const memoryUsage = process.memoryUsage()
  const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024)
  const heapTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024)
  const rssMB = Math.round(memoryUsage.rss / 1024 / 1024)
  const heapUsagePercent = Math.round((heapUsedMB / heapTotalMB) * 100)

  // メモリステータスの判定 (Render無料プラン: 512MB)
  let memoryStatus: 'ok' | 'warning' | 'critical' = 'ok'
  let shouldCleanup = false

  if (rssMB > 450 || heapUsagePercent > 90) {
    memoryStatus = 'critical'
    shouldCleanup = true
  } else if (rssMB > 400 || heapUsagePercent > 80) {
    memoryStatus = 'warning'
    shouldCleanup = true
  }

  // メモリクリーンアップ
  if (shouldCleanup) {
    global.memoryCleanupCount++
    // 再度GC実行
    if (global.gc) {
      global.gc()
    }
    logger.info('Memory cleanup executed', {
      count: global.memoryCleanupCount,
      rss: rssMB,
      heapUsage: heapUsagePercent
    })
  }

  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    memory: {
      heapUsed: `${heapUsedMB}MB`,
      heapTotal: `${heapTotalMB}MB`,
      rss: `${rssMB}MB`,
      usage: `${heapUsagePercent}%`,
      status: memoryStatus
    },
    checks: {
      database: { status: 'ok' },
      lineApi: { status: 'ok' },
      anthropicApi: { status: 'ok' },
      environment: { status: 'ok' }
    }
  }

  // メモリが critical の場合は unhealthy に
  if (memoryStatus === 'critical') {
    healthStatus.status = 'unhealthy'
  } else if (memoryStatus === 'warning') {
    healthStatus.status = 'degraded'
  }

  // 1. データベース接続チェック
  try {
    const dbStart = Date.now()
    const { error } = await supabase
      .from('generation_queue')
      .select('id')
      .limit(1)
    
    if (error) throw error
    
    healthStatus.checks.database.latency = Date.now() - dbStart
  } catch (error) {
    healthStatus.checks.database.status = 'error'
    healthStatus.checks.database.error = error instanceof Error ? error.message : 'Unknown error'
    healthStatus.status = 'unhealthy'
  }

  // 2. LINE API設定チェック
  if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !process.env.LINE_CHANNEL_SECRET) {
    healthStatus.checks.lineApi.status = 'error'
    healthStatus.checks.lineApi.error = 'Missing LINE API credentials'
    healthStatus.status = 'unhealthy'
  }

  // 3. Anthropic API設定チェック
  if (!process.env.ANTHROPIC_API_KEY) {
    healthStatus.checks.anthropicApi.status = 'error'
    healthStatus.checks.anthropicApi.error = 'Missing Anthropic API key'
    healthStatus.status = 'unhealthy'
  }

  // 4. 必須環境変数チェック
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'LINE_CHANNEL_ACCESS_TOKEN',
    'LINE_CHANNEL_SECRET',
    'ANTHROPIC_API_KEY'
  ]
  
  const missingVars = requiredEnvVars.filter(key => !process.env[key])
  if (missingVars.length > 0) {
    healthStatus.checks.environment.status = 'error'
    healthStatus.checks.environment.missing = missingVars
    healthStatus.status = 'degraded'
  }

  // ログ出力
  if (healthStatus.status !== 'healthy') {
    logger.warn('Health check failed', {
      status: healthStatus.status,
      checks: healthStatus.checks
    })
  }

  return NextResponse.json(healthStatus, {
    status: healthStatus.status === 'healthy' ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  })
}