import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY

export async function GET(request: NextRequest) {
  // 認証チェック
  const authHeader = request.headers.get('authorization')
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : request.nextUrl.searchParams.get('key')
  if (!ADMIN_API_KEY || apiKey !== ADMIN_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get('linkId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const exportFormat = searchParams.get('export')

    let query = supabaseAdmin
      .from('tracking_sessions')
      .select(`
        *,
        tracking_links (
          code,
          source,
          campaign_name
        )
      `)
      .order('created_at', { ascending: false })

    if (linkId) {
      query = query.eq('tracking_link_id', linkId)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch sessions' },
        { status: 500 }
      )
    }

    if (exportFormat === 'csv') {
      const csv = convertToCSV(data)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="tracking-sessions-${Date.now()}.csv"`
        }
      })
    }

    return NextResponse.json({ data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return 'No data available'
  }

  const headers = [
    'Session ID',
    'Campaign Name',
    'Source',
    'Code',
    'Auth Token',
    'IP Address',
    'User Agent',
    'Referer',
    'Is Bot',
    'LINE User ID',
    'Friend Added At',
    'Created At',
    'Expires At'
  ]

  const rows = data.map(session => [
    session.id,
    session.tracking_links?.campaign_name || '',
    session.tracking_links?.source || '',
    session.tracking_links?.code || '',
    session.auth_token,
    session.ip_address,
    session.user_agent,
    session.referer || '',
    session.is_bot ? 'Yes' : 'No',
    session.line_user_id || '',
    session.friend_added_at || '',
    session.created_at,
    session.expires_at
  ])

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell =>
        typeof cell === 'string' && cell.includes(',')
          ? `"${cell.replace(/"/g, '""')}"`
          : cell
      ).join(',')
    )
  ].join('\n')

  const BOM = '\uFEFF'
  return BOM + csvContent
}