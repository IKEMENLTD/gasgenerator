import { NextResponse } from 'next/server'
import { visionRateLimiter } from '@/lib/vision/rate-limiter'
import { logger } from '@/lib/utils/logger'

// 管理者認証（簡易版）
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || 'your-secure-admin-token'

export async function GET(request: Request) {
  try {
    // 認証チェック
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const token = authHeader.substring(7)
    if (token !== ADMIN_TOKEN) {
      logger.warn('Invalid admin token attempt')
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 })
    }
    
    // Vision API使用統計を取得
    const stats = await visionRateLimiter.getUsageStats()
    
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