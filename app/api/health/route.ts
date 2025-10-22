import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

export async function GET(_request: NextRequest) {
  const checks = {
    status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    checks: {
      database: false,
      environment: false,
      redis: false,
      lineApi: false
    },
    details: {} as Record<string, any>
  }

  // Check environment variables
  const requiredEnvVars = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'LINE_CHANNEL_SECRET',
    'LINE_CHANNEL_ACCESS_TOKEN'
  ]

  const missingEnvVars = requiredEnvVars.filter(key => !process.env[key])
  checks.checks.environment = missingEnvVars.length === 0

  if (missingEnvVars.length > 0) {
    checks.details.missingEnvVars = missingEnvVars
    checks.status = 'unhealthy'
  }

  // Check database connection
  try {
    const { error } = await supabase
      .from('tracking_links')
      .select('count')
      .limit(1)
      .single()

    if (!error) {
      checks.checks.database = true
    } else {
      checks.details.databaseError = error.message
      checks.status = checks.status === 'healthy' ? 'degraded' : checks.status
    }
  } catch (error: any) {
    checks.checks.database = false
    checks.details.databaseError = error?.message || 'Database connection failed'
    checks.status = 'unhealthy'
  }

  // Check Redis (if configured)
  if (process.env.REDIS_URL) {
    try {
      const { default: Redis } = await import('ioredis')
      const redis = new Redis(process.env.REDIS_URL)
      await redis.ping()
      await redis.quit()
      checks.checks.redis = true
    } catch (error: any) {
      checks.checks.redis = false
      checks.details.redisError = error?.message || 'Redis connection failed'
      checks.status = checks.status === 'healthy' ? 'degraded' : checks.status
    }
  } else {
    checks.checks.redis = true // Not required, so mark as OK
    checks.details.redis = 'Using memory store (Redis not configured)'
  }

  // Check LINE API
  try {
    const response = await fetch('https://api.line.me/v2/bot/info', {
      headers: {
        'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`
      },
      signal: AbortSignal.timeout(5000)
    })

    checks.checks.lineApi = response.ok

    if (!response.ok) {
      checks.details.lineApiStatus = response.status
      checks.status = checks.status === 'healthy' ? 'degraded' : checks.status
    }
  } catch (error: any) {
    checks.checks.lineApi = false
    checks.details.lineApiError = error?.message || 'LINE API check failed'
    checks.status = checks.status === 'healthy' ? 'degraded' : checks.status
  }

  // Determine overall status
  const allChecks = Object.values(checks.checks)
  if (allChecks.every(check => check === true)) {
    checks.status = 'healthy'
  } else if (checks.checks.database && checks.checks.environment) {
    checks.status = 'degraded'
  } else {
    checks.status = 'unhealthy'
  }

  // Return appropriate status code
  const statusCode = checks.status === 'healthy' ? 200 :
                     checks.status === 'degraded' ? 200 : 503

  return NextResponse.json(checks, { status: statusCode })
}

// Lightweight health check for monitoring
export async function HEAD(_request: NextRequest) {
  try {
    // Quick database check
    const { error } = await supabase
      .from('tracking_links')
      .select('id')
      .limit(1)
      .single()

    if (error) {
      return new NextResponse(null, { status: 503 })
    }

    return new NextResponse(null, { status: 200 })
  } catch {
    return new NextResponse(null, { status: 503 })
  }
}