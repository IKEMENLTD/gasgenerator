/**
 * Systems API
 *
 * システムカタログの取得
 * GET /api/systems - 公開システム一覧
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const featured = searchParams.get('featured')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = (supabaseAdmin as any)
      .from('systems')
      .select(`
        id,
        name,
        slug,
        description,
        category,
        developer_name,
        difficulty_level,
        estimated_time_minutes,
        download_count,
        view_count,
        rating_average,
        is_featured,
        created_at
      `)
      .eq('is_published', true)
      .order('is_featured', { ascending: false })
      .order('download_count', { ascending: false })
      .range(offset, offset + limit - 1)

    if (category) {
      query = query.eq('category', category)
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true)
    }

    const { data: systems, error, count } = await query

    if (error) {
      logger.error('Failed to fetch systems', { error })
      return NextResponse.json(
        { error: 'Failed to fetch systems' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      systems: systems || [],
      pagination: {
        limit,
        offset,
        total: count || systems?.length || 0
      }
    })

  } catch (error) {
    logger.error('Systems API error', { error })
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
