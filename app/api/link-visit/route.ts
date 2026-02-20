import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase/client'
import { logger } from '../../../lib/utils/logger'

export const runtime = 'nodejs'

/**
 * LIFF ブリッジからの訪問紐付けAPI
 * POST /api/link-visit
 * Body: { lineUserId, visitId, displayName, pictureUrl? }
 */
export async function POST(req: NextRequest) {
  try {
    const { lineUserId, visitId, displayName, pictureUrl } = await req.json()

    if (!lineUserId || !visitId) {
      return NextResponse.json({ error: 'Missing lineUserId or visitId' }, { status: 400 })
    }

    logger.info('LIFF link-visit request', { lineUserId, visitId })

    // 1. 訪問記録を取得して存在確認
    const { data: visit, error: visitError } = await supabaseAdmin
      .from('agency_tracking_visits')
      .select('id, tracking_link_id, agency_id, line_user_id, device_type, browser, os')
      .eq('id', visitId)
      .single()

    if (visitError || !visit) {
      logger.error('Visit not found', { visitId, error: visitError?.message })
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 })
    }

    // 既に紐付け済みの場合はスキップ
    if (visit.line_user_id) {
      logger.info('Visit already linked', { visitId, existingUser: visit.line_user_id })
      return NextResponse.json({ success: true, alreadyLinked: true })
    }

    // 2. LINE プロフィールを upsert
    const { error: profileError } = await supabaseAdmin
      .from('line_profiles')
      .upsert({
        user_id: lineUserId,
        display_name: displayName || null,
        picture_url: pictureUrl || null,
        fetched_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })

    if (profileError) {
      logger.error('line_profiles upsert error', { error: profileError.message })
    }

    // 3. 訪問記録に LINE ユーザーIDを紐付け
    const { error: updateError } = await supabaseAdmin
      .from('agency_tracking_visits')
      .update({
        line_user_id: lineUserId,
        metadata: {
          ...(visit as any).metadata,
          friend_type: 'liff_bridge',
          linked_at: new Date().toISOString(),
          match_method: 'liff_deterministic',
          display_name: displayName
        }
      })
      .eq('id', visitId)
      .is('line_user_id', null)

    if (updateError) {
      logger.error('Visit link update error', { error: updateError.message })
      return NextResponse.json({ error: 'Failed to link visit' }, { status: 500 })
    }

    logger.info(`LIFF visit linked: ${visitId} ← ${lineUserId} (${displayName})`)

    // 3.5 同じIPの未紐付け訪問を一括バックフィル（再訪問者のLINE名を遡及反映）
    try {
      const { data: linkedVisit } = await supabaseAdmin
        .from('agency_tracking_visits')
        .select('visitor_ip, tracking_link_id')
        .eq('id', visitId)
        .single()

      if (linkedVisit?.visitor_ip && linkedVisit.visitor_ip !== 'unknown') {
        const { data: backfilled } = await supabaseAdmin
          .from('agency_tracking_visits')
          .update({ line_user_id: lineUserId })
          .eq('tracking_link_id', linkedVisit.tracking_link_id)
          .eq('visitor_ip', linkedVisit.visitor_ip)
          .is('line_user_id', null)
          .select('id')

        if (backfilled && backfilled.length > 0) {
          logger.info(`Backfilled ${backfilled.length} visits for IP ${linkedVisit.visitor_ip}`)
        }
      }
    } catch (backfillErr) {
      logger.error('Backfill error (non-critical)', { error: backfillErr instanceof Error ? backfillErr.message : String(backfillErr) })
    }

    // 4. コンバージョン記録作成
    const { data: existingConversion } = await supabaseAdmin
      .from('agency_conversions')
      .select('id')
      .eq('visit_id', visitId)
      .eq('conversion_type', 'line_friend')
      .maybeSingle()

    if (!existingConversion) {
      const { error: convError } = await supabaseAdmin
        .from('agency_conversions')
        .insert([{
          agency_id: visit.agency_id,
          tracking_link_id: visit.tracking_link_id,
          visit_id: visit.id,
          line_user_id: lineUserId,
          line_display_name: displayName || null,
          device_type: visit.device_type || null,
          browser: visit.browser || null,
          os: visit.os || null,
          conversion_type: 'line_friend',
          conversion_value: 0,
          metadata: { linked_at: new Date().toISOString(), method: 'liff' }
        }])

      if (convError) {
        logger.error('agency_conversions insert error', { error: convError.message })
      }
    }

    return NextResponse.json({ success: true, linked: true })
  } catch (error) {
    logger.error('link-visit error', { error: error instanceof Error ? error.message : String(error) })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
