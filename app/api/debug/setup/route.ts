import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin' // Admin client for bypassing RLS

export const dynamic = 'force-dynamic'

// 開発環境/テスト環境のみ有効にするためのガード
const IS_DEV = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_APP_ENV === 'test'

export async function POST(req: NextRequest) {
    // 本番環境では絶対に実行させない
    if (!IS_DEV && process.env.VERCEL_ENV === 'production') {
        return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 })
    }

    try {
        const { userId, action, planId, monthsAgo } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 })
        }

        const now = new Date()
        let updateData: any = {}
        let subscriptionData: any = {}

        /* 
          Action Types:
          - 'reset_free': 無料プランに戻す
          - 'set_premium_new': Premium新規契約（今から）
          - 'set_premium_aged': Premium契約（Xヶ月経過済み）
          - 'set_professional': Professional契約
        */

        switch (action) {
            case 'reset_free':
                // Usersテーブル
                updateData = {
                    subscription_status: 'free',
                    subscription_end_date: null,
                    stripe_customer_id: null // テスト用にクリア（必要に応じて維持）
                }
                // Subscriptionsテーブル: 全部キャンセル扱いに
                await (supabaseAdmin as any)
                    .from('subscriptions')
                    .update({ status: 'cancelled' })
                    .eq('user_id', userId)
                break

            case 'set_premium_new':
                updateData = {
                    subscription_status: 'premium',
                    subscription_started_at: now.toISOString(),
                    payment_start_date: now.toISOString()
                }
                subscriptionData = {
                    status: 'active',
                    current_plan_id: 'basic', // ID mapping: basic = premium plan ($10k)
                    current_plan_price: 10000,
                    contract_start_date: now.toISOString()
                }
                break

            case 'set_premium_aged':
                const pastDate = new Date()
                pastDate.setMonth(pastDate.getMonth() - (monthsAgo || 3))

                updateData = {
                    subscription_status: 'premium',
                    subscription_started_at: pastDate.toISOString(),
                    payment_start_date: pastDate.toISOString()
                }
                subscriptionData = {
                    status: 'active',
                    current_plan_id: 'basic',
                    current_plan_price: 10000,
                    contract_start_date: pastDate.toISOString()
                }
                break

            case 'set_professional':
                updateData = {
                    subscription_status: 'professional',
                    subscription_started_at: now.toISOString(),
                    payment_start_date: now.toISOString()
                }
                subscriptionData = {
                    status: 'active',
                    current_plan_id: 'professional',
                    current_plan_price: 50000,
                    contract_start_date: now.toISOString()
                }
                break

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        // 1. Usersテーブル更新
        if (Object.keys(updateData).length > 0) {
            await (supabaseAdmin as any)
                .from('users')
                .update(updateData)
                .eq('line_user_id', userId)
        }

        // 2. Subscriptionsテーブル更新 (Insert or Update active)
        if (Object.keys(subscriptionData).length > 0) {
            // 既存のアクティブなものを探す
            const { data: existing } = await (supabaseAdmin as any)
                .from('subscriptions')
                .select('id')
                .eq('user_id', userId)
                .eq('status', 'active')
                .single()

            if (existing) {
                await (supabaseAdmin as any)
                    .from('subscriptions')
                    .update(subscriptionData)
                    .eq('id', existing.id)
            } else {
                await (supabaseAdmin as any)
                    .from('subscriptions')
                    .insert({
                        user_id: userId,
                        ...subscriptionData,
                        plan_history: [],
                        stripe_customer_id: 'cus_TEST_' + Math.random().toString(36).substring(7) // ダミー
                    })
            }
        }

        return NextResponse.json({ success: true, message: `Action ${action} completed` })

    } catch (error: any) {
        console.error('Debug API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
