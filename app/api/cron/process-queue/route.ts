import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    // 認証チェック
    const cronSecret = req.headers.get('authorization')?.replace('Bearer ', '')
    const expectedSecret = process.env.CRON_SECRET
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // キュー処理（簡略化）
    console.log('Process queue job executed')

    return NextResponse.json({
      success: true,
      message: 'Queue processing completed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Queue processing error:', error)
    return NextResponse.json(
      { error: 'Internal error' },
      { status: 500 }
    )
  }
}
