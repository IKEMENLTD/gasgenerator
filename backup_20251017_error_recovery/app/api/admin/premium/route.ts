import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { adminAuthMiddleware } from '@/middleware/admin-auth'
import { generateActivationCode } from '@/lib/premium-handler'
import * as crypto from 'crypto'

// Get all premium users
export const GET = adminAuthMiddleware(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const onlyActive = searchParams.get('active') === 'true'

    let query = supabaseAdmin
      .from('user_states')
      .select('*')

    if (onlyActive) {
      query = query
        .eq('is_premium', true)
        .gte('premium_expires_at', new Date().toISOString())
    } else {
      query = query.eq('is_premium', true)
    }

    const { data, error } = await query
      .order('premium_activated_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch premium users' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      users: data,
      total: data?.length || 0,
      active: data?.filter(u =>
        u.premium_expires_at && new Date(u.premium_expires_at) > new Date()
      ).length || 0
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// Generate new activation code
export const POST = adminAuthMiddleware(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { type = 'premium', duration = 30, customCode } = body

    let code: string
    let codeHash: string

    if (customCode) {
      // Use custom code provided
      code = customCode
      codeHash = crypto.createHash('sha256').update(code).digest('hex')
    } else {
      // Generate new code
      code = await generateActivationCode(type, duration)
      codeHash = crypto.createHash('sha256').update(code).digest('hex')
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + duration)

    const { error } = await supabaseAdmin
      .from('activation_codes')
      .insert({
        code: code,
        code_hash: codeHash,
        type: type,
        expires_at: expiresAt.toISOString(),
        metadata: {
          generated_via: 'admin_api',
          duration_days: duration,
          created_at: new Date().toISOString()
        }
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json(
        { error: 'Failed to create activation code' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      code: code,
      hash: codeHash,
      expiresAt: expiresAt.toISOString(),
      type: type,
      duration: duration
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// Manually activate premium for a user
export const PUT = adminAuthMiddleware(async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { lineUserId, duration = 30, reason = 'manual_activation' } = body

    if (!lineUserId) {
      return NextResponse.json(
        { error: 'LINE User ID is required' },
        { status: 400 }
      )
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + duration)

    const { error } = await supabaseAdmin
      .from('user_states')
      .upsert({
        line_user_id: lineUserId,
        is_premium: true,
        premium_activated_at: new Date().toISOString(),
        premium_expires_at: expiresAt.toISOString(),
        premium_activation_code: `admin_${Date.now()}`,
        premium_features: [
          'unlimited_tracking',
          'advanced_analytics',
          'api_access',
          'priority_support'
        ],
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'line_user_id'
      })

    if (error) {
      return NextResponse.json(
        { error: 'Failed to activate premium' },
        { status: 500 }
      )
    }

    // Log the activation
    await supabaseAdmin
      .from('activation_codes')
      .insert({
        code: `admin_manual_${Date.now()}`,
        code_hash: crypto.createHash('sha256')
          .update(`admin_${lineUserId}_${Date.now()}`)
          .digest('hex'),
        type: 'admin_manual',
        used: true,
        used_by: lineUserId,
        used_at: new Date().toISOString(),
        metadata: {
          reason: reason,
          activated_by: 'admin_api',
          duration_days: duration
        }
      })

    return NextResponse.json({
      success: true,
      lineUserId: lineUserId,
      expiresAt: expiresAt.toISOString(),
      duration: duration
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})

// Revoke premium access
export const DELETE = adminAuthMiddleware(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url)
    const lineUserId = searchParams.get('userId')

    if (!lineUserId) {
      return NextResponse.json(
        { error: 'LINE User ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabaseAdmin
      .from('user_states')
      .update({
        is_premium: false,
        premium_expires_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('line_user_id', lineUserId)

    if (error) {
      return NextResponse.json(
        { error: 'Failed to revoke premium' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Premium access revoked'
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
})