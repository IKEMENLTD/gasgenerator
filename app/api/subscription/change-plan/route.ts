import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { calculateCancellationFee, PLAN_CONFIG, PlanId } from '@/lib/subscription-utils'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    try {
        const { userId, newPlanId } = await req.json()

        if (!userId || !newPlanId) {
            return NextResponse.json({ error: 'Missing userId or newPlanId' }, { status: 400 })
        }

        // 1. 現在の契約情報を取得（subscriptions優先）
        const { data: subscription, error: subError } = await (supabaseAdmin as any)
            .from('subscriptions')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'active')
            .single()

        // ユーザー情報（Stripe Customer ID用）
        const { data: user } = await (supabaseAdmin as any)
            .from('users')
            .select('*')
            .eq('line_user_id', userId)
            .single()

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        const customerId = subscription?.stripe_customer_id || user.stripe_customer_id
        if (!customerId) {
            // まだサブスクリプションがない場合は新規契約扱いだが、
            // Plan Change APIとしてはエラーまたは新規契約用のURLを返す
            return NextResponse.json({ error: 'No active subscription found to change' }, { status: 400 })
        }

        const currentPrice = subscription?.current_plan_price ||
            (user.subscription_status === 'professional' ? 50000 : 10000)
        const contractStartDate = subscription?.contract_start_date || user.payment_start_date

        // プラン識別
        const targetPlan = Object.values(PLAN_CONFIG).find(p => p.id === newPlanId)
        if (!targetPlan) {
            return NextResponse.json({ error: 'Invalid plan ID' }, { status: 400 })
        }

        // アップグレードかダウングレードか判定
        const isDowngrade = targetPlan.price < currentPrice
        const isUpgrade = targetPlan.price > currentPrice

        if (isDowngrade) {
            // ダウングレード：6ヶ月ルールチェック
            const feeInfo = calculateCancellationFee(contractStartDate, currentPrice)

            if (feeInfo.cancellationFee > 0) {
                // 違約金支払いが必要 -> Checkout Session作成
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [
                        {
                            price_data: {
                                currency: 'jpy',
                                product_data: {
                                    name: 'プラン変更違約金（ダウングレード）',
                                    description: `${feeInfo.remainingMonths}ヶ月分の残存期間違約金`,
                                },
                                unit_amount: feeInfo.cancellationFee,
                            },
                            quantity: 1,
                        },
                        // NOTE: ここで新しいプランのサブスクリプションも同時に開始するか、
                        // あるいはWebhookで違約金支払い完了を受けてから変更するかが設計判断。
                        // 一般的には「違約金支払い」=「変更許可」なので、Metadataに次プラン情報を入れてWebhookで処理する。
                    ],
                    mode: 'payment',
                    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/mypage?planChange=success`,
                    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/mypage?planChange=cancelled`,
                    client_reference_id: userId,
                    metadata: {
                        type: 'downgrade_fee',
                        userId: userId,
                        newPlanId: newPlanId,
                        previousPlanPrice: currentPrice,
                    },
                    customer: customerId
                })

                return NextResponse.json({
                    requiresPayment: true,
                    checkoutUrl: session.url,
                    feeInfo
                })
            }
        }

        // アップグレードまたは違約金なしのダウングレード
        // Stripeのサブスクリプションアイテムを更新

        // 1. アクティブなサブスクリプションをStripeから取得
        const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active' })
        if (subs.data.length === 0) {
            // Stripe上にない（DB不整合など）
            return NextResponse.json({ error: 'Stripe subscription not found' }, { status: 404 })
        }
        const currentStripeSub = subs.data[0]
        const subscriptionItemId = currentStripeSub.items.data[0].id

        // 2. 新しいPrice IDを取得（環境変数などから）
        // NOTE: PLAN_CONFIG.stripePriceId は .env からロードされることを想定
        const newPriceId = targetPlan.stripePriceId
        if (!newPriceId) {
            return NextResponse.json({ error: 'Configuration error: Missing Price ID' }, { status: 500 })
        }

        // 3. 即時変更（比例配分あり/なしの設定は要件次第だが通常はproration_behaviorで制御）
        // アップグレードは即時請求、ダウングレードは次月反映などが一般的だが、要件では「違約金払って即変更」かもしれない
        // ここでは標準的な挙動（即時反映、差額請求/返金）とする
        const updatedSub = await stripe.subscriptions.update(currentStripeSub.id, {
            items: [{
                id: subscriptionItemId,
                price: newPriceId,
            }],
            proration_behavior: 'always_invoice', // 差額を即座に計算・請求
        })

        // 4. DB更新
        // Webhookでも更新されるが、ここでも同期的に返せるとUIがスムーズ
        if (subscription) {
            // 履歴を保存しつつ更新
            const history = (subscription.plan_history as any[]) || []
            history.push({
                from: subscription.current_plan_id,
                to: newPlanId,
                date: new Date().toISOString(),
                reason: isUpgrade ? 'upgrade' : 'downgrade_free'
            })

            await (supabaseAdmin as any).from('subscriptions').update({
                current_plan_id: newPlanId,
                current_plan_price: targetPlan.price,
                plan_history: history,
                // プラン変更時は契約開始日をリセット（新たな6ヶ月縛り開始）
                contract_start_date: new Date().toISOString(),
            }).eq('id', subscription.id)
        }

        // usersテーブルも念のため同期
        await (supabaseAdmin as any).from('users').update({
            subscription_status: newPlanId === 'professional' ? 'professional' : 'premium'
        }).eq('line_user_id', userId)

        return NextResponse.json({
            success: true,
            message: 'Plan changed successfully',
            plan: targetPlan.name
        })

    } catch (error: any) {
        console.error('Plan Change API Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
