import { NextResponse } from 'next/server'
import { databaseRateLimiter } from '@/lib/vision/database-rate-limiter'
import { logger } from '@/lib/utils/logger'
import { JWTManager } from '@/lib/auth/jwt-manager'

export async function GET(request: Request) {
  try {
    // JWT認証チェック（強化版）
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing authorization header in admin request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7).trim()
    
    // トークンの形式チェック
    if (!token || token.length < 20) {
      logger.warn('Invalid token format in admin request')
      return NextResponse.json({ error: 'Invalid token format' }, { status: 401 })
    }
    
    // トークン検証（タイミング攻撃対策付き）
    const startTime = Date.now()
    const verification = JWTManager.verifyToken(token)
    
    // 最小処理時間を保証（タイミング攻撃対策）
    const elapsedTime = Date.now() - startTime
    if (elapsedTime < 10) {
      await new Promise(resolve => setTimeout(resolve, 10 - elapsedTime))
    }
    
    if (!verification.valid) {
      logger.warn('Invalid admin token attempt', { 
        error: verification.error,
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      })
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // トークン有効期限チェック
    const payload = verification.payload
    if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
      logger.warn('Expired admin token', { userId: payload?.sub })
      return NextResponse.json({ error: 'Token expired' }, { status: 403 })
    }
    
    // 管理者権限チェック（厳密）
    if (payload.role !== 'admin' || !payload.permissions?.includes('view_stats')) {
      logger.warn('Insufficient permissions for admin access', { 
        userId: payload.sub,
        role: payload.role,
        permissions: payload.permissions
      })
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }
    
    // IPアドレスチェック（オプション）
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                    request.headers.get('x-real-ip')
    if (clientIP && process.env.ADMIN_ALLOWED_IPS) {
      const allowedIPs = process.env.ADMIN_ALLOWED_IPS.split(',')
      if (!allowedIPs.includes(clientIP)) {
        logger.warn('Admin access from unauthorized IP', { 
          userId: payload.sub,
          ip: clientIP 
        })
        return NextResponse.json({ error: 'Access denied from this IP' }, { status: 403 })
      }
    }
    
    // Vision API使用統計を取得（全ユーザー）
    const globalStats = await databaseRateLimiter.checkGlobalLimit()
    const stats = {
      ...globalStats,
      alertLevel: globalStats.currentUsage >= globalStats.alertThreshold ? 'warning' : 
                  globalStats.currentUsage >= globalStats.monthlyLimit ? 'critical' : 'normal'
    }
    
    // アラート状態に応じた詳細情報
    const alerts = []
    
    if (stats.alertLevel === 'critical') {
      alerts.push({
        level: 'CRITICAL',
        message: '月間使用量上限に達しました！Vision APIは停止中です。',
        action: '料金プランの見直しまたは制限値の調整が必要です。'
      })
    } else if (stats.alertLevel === 'warning') {
      alerts.push({
        level: 'WARNING',
        message: '月間使用量が警告レベル（80%）に達しています。',
        action: '使用状況を監視し、必要に応じて制限を強化してください。'
      })
    }
    
    // 推定コスト（日本円換算）
    const estimatedCostJPY = stats.estimatedCost * 150 // $1 = 150円
    
    // 本日のペースで月末までいった場合の予測
    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const dayOfMonth = today.getDate()
    const projectedMonthTotal = stats.monthTotal > 0 
      ? Math.round((stats.monthTotal / dayOfMonth) * daysInMonth)
      : 0
    const projectedCost = projectedMonthTotal * 0.01275 * 150
    
    return NextResponse.json({
      current: {
        today: stats.todayTotal,
        month: stats.monthTotal,
        costUSD: stats.estimatedCost.toFixed(2),
        costJPY: Math.round(estimatedCostJPY),
      },
      projected: {
        monthEnd: projectedMonthTotal,
        costJPY: Math.round(projectedCost),
      },
      limits: {
        globalMonthly: 500,
        remaining: 500 - stats.monthTotal,
        percentUsed: Math.round((stats.monthTotal / 500) * 100),
      },
      alerts,
      recommendation: getRecommendation(stats.monthTotal, dayOfMonth, daysInMonth)
    })
    
  } catch (error) {
    logger.error('Vision stats API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

function getRecommendation(
  monthTotal: number, 
  dayOfMonth: number, 
  daysInMonth: number
): string {
  const dailyAverage = monthTotal / dayOfMonth
  const remainingDays = daysInMonth - dayOfMonth
  const projectedTotal = monthTotal + (dailyAverage * remainingDays)
  
  if (projectedTotal > 500) {
    return '⚠️ このペースだと月末までに上限を超える可能性があります。制限を強化することをお勧めします。'
  } else if (projectedTotal > 400) {
    return '📊 使用量が多めです。推移を注意深く監視してください。'
  } else {
    return '✅ 現在のペースであれば問題ありません。'
  }
}