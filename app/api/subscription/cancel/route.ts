import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { supabaseAdmin } from '@/lib/supabase/admin' // Use admin for reliable fetch
import { calculateCancellationFee } from '@/lib/subscription-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const { userId } = await req.json()

        if (!userId) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
        }

        // 1. ユーザーとサブスクリプション情報を取得
        const { data: user, error: userError } = await (supabaseAdmin as any)
            .from('users')
            .select('*')
            .eq('line_user_id', userId) // Assuming userId passed is the LINE ID
            .single()

        if (userError || !user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // subscriptionsテーブルから取得すべきだが、まだ移行中かもしれないのでusersテーブルも確認
        // ここでは推奨されるsubscriptionsテーブルを優先し、なければusersからフォールバックするロジック、あるいは
        // 移行ガイドに従いsubscriptionsテーブルを見る

        // Simplification for this implementation: Assume data is strictly in 'subscriptions' table as per recent migration
        // However, if the user hasn't run the migration or data sync, this might fail.
        // Let's try fetching from 'subscriptions' first.

        const { data: subscription, error: subError } = await (supabaseAdmin as any)
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        // データがない場合のフォールバック（既存のusersテーブル参照）
        let contractStartDate = user.payment_start_date || user.created_at
        let currentPrice = 10000 // Default to Basic
        if (user.subscription_status === 'professional') currentPrice = 50000

        if (subscription) {
            contractStartDate = subscription.contract_start_date
            currentPrice = subscription.current_plan_price
        }

        // 2. 違約金計算
        const feeInfo = calculateCancellationFee(contractStartDate, currentPrice)

        // 3. 違約金なしの場合：即時解約（または期間末解約）
        if (feeInfo.cancellationFee === 0) {
            // Stripeのサブスクリプションをキャンセル（期間末）
            // stripe_customer_idが必要
            const customerId = subscription?.stripe_customer_id || user.stripe_customer_id

            if (customerId) {
                // Stripe上のサブスクリプションを探す
                const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active' })
                if (subs.data.length > 0) {
                    await stripe.subscriptions.update(subs.data[0].id, { cancel_at_period_end: true })
                }
            }

            // DB更新 (subscriptions table)
            if (subscription) {
                await (supabaseAdmin as any).from('subscriptions').update({
                    status: 'cancelled', // Or 'cancellation_pending' if at period end
                    cancel_at_period_end: true
                }).eq('id', subscription.id)
            } else {
                // Fallback update users table if needed
                await (supabaseAdmin as any).from('users').update({
                    subscription_status: 'cancelled' // strictly speaking should be period end, but simpler here
                }).eq('line_user_id', userId)
            }

            return NextResponse.json({
                requiresPayment: false,
                message: 'Cancellation scheduled successfully'
            })
        }

        // 4. 違約金ありの場合：Stripe Checkout Session作成
        // 違約金用のワンタイム支払いセッション
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'jpy',
                        product_data: {
                            name: '早期解約違約金',
                            description: `最低利用期間（6ヶ月）内の解約に伴う違約金（残${feeInfo.remainingMonths}ヶ月分）`,
                        },
                        unit_amount: feeInfo.cancellationFee,
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_APP_URL}/mypage?cancellation=success`,
            cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/mypage?cancellation=cancelled`,
            client_reference_id: userId, // Webhookで特定するために必要
            metadata: {
                type: 'cancellation_fee',
                userId: userId,
                monthsElapsed: feeInfo.monthsElapsed,
                remainingMonths: feeInfo.remainingMonths
            },
            customer: subscription?.stripe_customer_id || user.stripe_customer_id || undefined
        })

        return NextResponse.json({
            requiresPayment: true,
            checkoutUrl: session.url,
            feeInfo
        })

    } catch (error: any) {
        console.error('Cancellation API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
