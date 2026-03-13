import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import Stripe from 'stripe'
import { supabaseAdmin as supabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import EnvironmentValidator from '@/lib/config/environment'

export const runtime = 'nodejs' // Edge RuntimeからNode.jsに変更
export const dynamic = 'force-dynamic'

/**
 * Stripe Webhookハンドラー
 */
export async function POST(req: NextRequest) {
  const reqId = crypto.randomUUID()
  logger.info(`[${reqId}] Stripe webhook request received`)

  try {
    const body = await req.text()
    const signature = headers().get('stripe-signature') as string

    if (!signature) {
      logger.error(`[${reqId}] Missing stripe-signature header`)
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
    }

    const stripeSecretKey = EnvironmentValidator.getRequired('STRIPE_SECRET_KEY')
    const webhookSecret = EnvironmentValidator.getRequired('STRIPE_WEBHOOK_SECRET')

    // Stripeライブラリを使用して署名検証（より確実）
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16', // 最新または互換性のあるバージョン
      typescript: true,
    })

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
      logger.info(`[${reqId}] Signature verification successful`, { eventType: event.type, eventId: event.id })
    } catch (err: any) {
      logger.error(`[${reqId}] Signature verification failed`, { error: err.message })
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
    }

    const eventType = event.type

    // ────────────────────────────────────────────────────────────────
    // 冪等性チェック（二重処理防止）
    //
    // このハンドラー（Render）はユーザーサブスク更新・LINE通知を担当する。
    // Netlify側ハンドラーは代理店コミッション計算を担当する。
    // 両者が同じStripeイベントを受信するため、ハンドラー名をサフィックス
    // として付加した複合キー "evt_xxx:render" で独立して重複制御する。
    // これにより、Netlify が先に処理してもこちらがスキップされない。
    //
    // 競合状態対策:
    //   INSERT の UNIQUE 違反エラー (23505) を検出してスキップする。
    //   SELECT → INSERT の非アトミック操作を避け、INSERT 結果のみで判定する。
    // ────────────────────────────────────────────────────────────────
    const handlerEventId = `${event.id}:render`

    const { error: insertError } = await supabase
      .from('stripe_events')
      .insert({
        event_id: handlerEventId,
        event_type: eventType,
        processed_at: new Date().toISOString()
      })

    if (insertError) {
      // UNIQUE 制約違反 (23505) = 既に処理済み or 同時リクエストが先行
      if (insertError.code === '23505') {
        logger.info(`[${reqId}] Duplicate webhook event (render handler), skipping`, { eventId: event.id })
        return NextResponse.json({ received: true, duplicate: true })
      }
      // その他のDBエラーはログに残して続行しない
      logger.error(`[${reqId}] Failed to record stripe event for idempotency`, { eventId: event.id, error: insertError })
      return NextResponse.json({ error: 'Failed to record event for idempotency' }, { status: 500 })
    }

    switch (eventType) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata || {}

        logger.info(`[${reqId}] Processing checkout.session.completed`, { sessionId: session.id, metadata })

        // --- 1. 違約金支払い（解約またはダウングレード）の処理 ---
        if (metadata.type === 'cancellation_fee' || metadata.type === 'downgrade_fee') {
          const userId = metadata.userId // LINE User ID
          const amountTotal = session.amount_total || 0

          logger.info(`[${reqId}] Processing fee payment`, { type: metadata.type, userId, amount: amountTotal })

          // 決済履歴を記録
          await supabase
            .from('payment_history')
            .insert({
              user_id: userId,
              stripe_session_id: session.id,
              stripe_customer_id: session.customer as string,
              amount: amountTotal,
              currency: 'jpy',
              plan_type: metadata.type === 'cancellation_fee' ? 'cancellation_fee' : 'downgrade_fee',
              status: 'completed',
              paid_at: new Date().toISOString()
            })

          // Subscriptionsテーブルの更新
          if (metadata.type === 'cancellation_fee') {
            await supabase
              .from('subscriptions')
              .update({
                status: 'cancelled',
                cancellation_fee_paid: true,
                cancellation_fee_amount: amountTotal,
                cancelled_at: new Date().toISOString()
              })
              .eq('user_id', userId)
              .eq('status', 'active')

            await supabase.from('users').update({
              subscription_status: 'cancelled',
              subscription_cancelled_at: new Date().toISOString()
            }).eq('line_user_id', userId)

          } else if (metadata.type === 'downgrade_fee') {
            const newPlanId = metadata.newPlanId
            const newPlanPrice = newPlanId === 'professional' ? 50000 : 10000

            await supabase
              .from('subscriptions')
              .update({
                cancellation_fee_paid: true,
                cancellation_fee_amount: amountTotal,
                current_plan_id: newPlanId,
                current_plan_price: newPlanPrice,
                // プラン変更時は契約開始日をリセット（新たな6ヶ月縛り開始）
                contract_start_date: new Date().toISOString(),
              })
              .eq('user_id', userId)

            await supabase.from('users').update({
              subscription_status: newPlanId === 'professional' ? 'professional' : 'premium'
            }).eq('line_user_id', userId)
          }

          break
        }

        // --- 2. 通常の新規サブスクリプション登録処理 ---
        const lineUserId = session.client_reference_id
        const amountTotal = session.amount_total || 0

        if (lineUserId) {
          logger.info(`[${reqId}] Processing new subscription`, { lineUserId, amountTotal })

          let decodedLineUserId: string
          try {
            // client_reference_idが生のIDかBase64か判定してデコード
            // 通常、client_reference_idにはLINE User IDがセットされているはず
            if (lineUserId.match(/^U[0-9a-f]{32}$/)) {
              decodedLineUserId = lineUserId
              logger.info(`[${reqId}] Using raw LINE User ID`, { decodedLineUserId })
            } else {
              decodedLineUserId = Buffer.from(lineUserId, 'base64').toString('utf-8')
              logger.info(`[${reqId}] Decoded Base64 LINE User ID`, { decodedLineUserId })
            }

            if (!decodedLineUserId.match(/^U[0-9a-f]{32}$/)) {
              logger.error(`[${reqId}] Invalid LINE User ID format`, { decodedLineUserId })
              // エラーでも200を返して再送を防ぐ（ログで確認するため）
              return NextResponse.json({ received: true, error: 'Invalid user ID format' })
            }
          } catch (decodeError) {
            logger.error(`[${reqId}] Failed to decode LINE User ID`, { lineUserId, error: decodeError })
            return NextResponse.json({ received: true, error: 'Decode error' })
          }

          // 二重登録チェック
          if (session.mode === 'subscription') {
            const { data: existingUser } = await supabase
              .from('users')
              .select('subscription_status')
              .eq('line_user_id', decodedLineUserId)
              .single()

            if (existingUser?.subscription_status === 'premium' || existingUser?.subscription_status === 'professional') {
              logger.warn(`[${reqId}] User already has active subscription`, { lineUserId: decodedLineUserId })
              // 既に処理済みとして扱う
              return NextResponse.json({ received: true, alreadySubscribed: true })
            }
          }

          const subscriptionType = amountTotal >= 50000 ? 'professional' : 'premium'
          const now = new Date()

          // Usersテーブル更新
          const { error: userError } = await supabase
            .from('users')
            .update({
              subscription_status: subscriptionType,
              stripe_customer_id: session.customer as string,
              subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              subscription_started_at: now.toISOString(),
              payment_start_date: now.toISOString(),
              last_reset_month: 0,
              monthly_usage_count: 0
            })
            .eq('line_user_id', decodedLineUserId)

          if (userError) logger.error(`[${reqId}] Failed to update users table`, { userError })

          // Subscriptionsテーブル挿入
          const { error: subInsertError } = await supabase
            .from('subscriptions')
            .insert({
              user_id: decodedLineUserId,
              status: 'active',
              contract_start_date: now.toISOString(),
              current_plan_id: subscriptionType === 'professional' ? 'professional' : 'basic',
              current_plan_price: amountTotal,
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              plan_history: [{
                date: now.toISOString(),
                action: 'initial_subscription',
                plan: subscriptionType
              }]
            })

          if (subInsertError) logger.error(`[${reqId}] Failed to insert subscriptions`, { subInsertError })

          // 決済履歴
          await supabase
            .from('payment_history')
            .insert({
              user_id: decodedLineUserId,
              stripe_session_id: session.id,
              stripe_customer_id: session.customer as string,
              amount: amountTotal,
              currency: 'jpy',
              plan_type: subscriptionType,
              status: 'completed',
              paid_at: new Date().toISOString()
            })

          // LINE通知
          try {
            logger.info(`[${reqId}] Sending LINE notification`, { decodedLineUserId })
            // 動的インポートではなく直接インポートを試みる（またはrequire）
            // Edge Runtimeではないのでrequire可能だが、ここではimportを使用
            const { LineApiClient } = await import('@/lib/line/client')
            const lineClient = new LineApiClient()
            const confirmationMessage = subscriptionType === 'professional'
              ? '🎆 決済が完了しました！\n\nプロフェッショナルプランが有効化されました。'
              : '💎 決済が完了しました！\n\nプレミアムプランが有効化されました。'

            await lineClient.pushMessage(decodedLineUserId, [{
              type: 'text',
              text: confirmationMessage
            }])
            logger.info(`[${reqId}] LINE notification sent successfully`)
          } catch (e: any) {
            logger.error(`[${reqId}] Failed to send LINE message`, { error: e.message })
          }
        } else {
          logger.warn(`[${reqId}] Missing client_reference_id in session`)
        }
        break

      case 'customer.subscription.updated': {
        const subUpdated = event.data.object as Stripe.Subscription
        const updatedCustomerId = subUpdated.customer as string
        logger.info(`[${reqId}] Processing subscription update`, {
          id: subUpdated.id,
          status: subUpdated.status,
          cancelAtPeriodEnd: subUpdated.cancel_at_period_end,
          customerId: updatedCustomerId
        })

        // ユーザーをstripe_customer_idで検索
        const { data: updatedUser } = await supabase
          .from('users')
          .select('line_user_id, subscription_status')
          .eq('stripe_customer_id', updatedCustomerId)
          .single()

        if (!updatedUser) {
          logger.warn(`[${reqId}] No user found for customer`, { customerId: updatedCustomerId })
          break
        }

        const updatedLineUserId = updatedUser.line_user_id

        // キャンセル予約（期間終了時にキャンセル）
        if (subUpdated.cancel_at_period_end) {
          const cancelAt = subUpdated.cancel_at
            ? new Date(subUpdated.cancel_at * 1000).toISOString()
            : null

          const { error: cancelUserErr } = await supabase.from('users').update({
            subscription_cancelled_at: new Date().toISOString(),
            subscription_end_date: cancelAt
          }).eq('line_user_id', updatedLineUserId)

          if (cancelUserErr) logger.error(`[${reqId}] Failed to update user for cancel`, { error: cancelUserErr })

          const { error: cancelSubErr } = await supabase.from('subscriptions').update({
            status: 'active', // まだアクティブ（期間終了まで利用可能）
            cancelled_at: new Date().toISOString()
          })
          .eq('user_id', updatedLineUserId)
          .eq('status', 'active')

          if (cancelSubErr) logger.error(`[${reqId}] Failed to update subscription for cancel`, { error: cancelSubErr })

          // LINE通知: キャンセル予約
          try {
            const { LineApiClient } = await import('@/lib/line/client')
            const lineClient = new LineApiClient()
            const endDateStr = cancelAt
              ? new Date(cancelAt).toLocaleDateString('ja-JP')
              : '次の更新日'
            await lineClient.pushMessage(updatedLineUserId, [{
              type: 'text',
              text: `📋 サブスクリプションのキャンセルを受け付けました。\n\n${endDateStr}まで引き続きご利用いただけます。`
            }])
          } catch (e: any) {
            logger.error(`[${reqId}] Failed to send LINE cancellation notice`, { error: e.message })
          }

          break
        }

        // ステータス別処理
        if (subUpdated.status === 'active') {
          // サブスクリプションが（再）アクティブになった場合
          const currentPeriodEnd = subUpdated.current_period_end
            ? new Date(subUpdated.current_period_end * 1000).toISOString()
            : null

          const amount = subUpdated.items?.data?.[0]?.price?.unit_amount || 0
          const newStatus = amount >= 50000 ? 'professional' : 'premium'

          const { error: activeUserErr } = await supabase.from('users').update({
            subscription_status: newStatus,
            subscription_end_date: currentPeriodEnd,
            subscription_cancelled_at: null // キャンセル予約をクリア
          }).eq('line_user_id', updatedLineUserId)

          if (activeUserErr) logger.error(`[${reqId}] Failed to reactivate user`, { error: activeUserErr })

          const { error: activeSubErr } = await supabase.from('subscriptions').update({
            status: 'active',
            cancelled_at: null
          })
          .eq('user_id', updatedLineUserId)
          .in('status', ['active', 'cancelled'])

          if (activeSubErr) logger.error(`[${reqId}] Failed to reactivate subscription`, { error: activeSubErr })

        } else if (subUpdated.status === 'past_due') {
          // 支払い失敗
          logger.warn(`[${reqId}] Subscription past_due`, { userId: updatedLineUserId })

          await supabase.from('subscriptions').update({
            status: 'active' // まだアクセス可能だが支払い未完了
          })
          .eq('user_id', updatedLineUserId)
          .eq('status', 'active')

          // LINE通知: 支払い失敗
          try {
            const { LineApiClient } = await import('@/lib/line/client')
            const lineClient = new LineApiClient()
            await lineClient.pushMessage(updatedLineUserId, [{
              type: 'text',
              text: '⚠️ お支払いの処理に問題が発生しました。\n\nお支払い方法をご確認ください。更新がない場合、サービスが停止される可能性があります。'
            }])
          } catch (e: any) {
            logger.error(`[${reqId}] Failed to send LINE past_due notice`, { error: e.message })
          }
        }
        // incomplete, incomplete_expired などは新規登録失敗のため処理不要

        break
      }

      case 'customer.subscription.deleted': {
        const subDeleted = event.data.object as Stripe.Subscription
        const deletedCustomerId = subDeleted.customer as string
        logger.info(`[${reqId}] Processing subscription deletion`, {
          id: subDeleted.id,
          customerId: deletedCustomerId
        })

        // ユーザーをstripe_customer_idで検索
        const { data: deletedUser } = await supabase
          .from('users')
          .select('line_user_id, subscription_status')
          .eq('stripe_customer_id', deletedCustomerId)
          .single()

        if (!deletedUser) {
          logger.warn(`[${reqId}] No user found for deleted subscription`, { customerId: deletedCustomerId })
          break
        }

        const deletedLineUserId = deletedUser.line_user_id

        // Usersテーブル: サブスク終了
        const { error: deleteUserError } = await supabase.from('users').update({
          subscription_status: 'free',
          subscription_end_date: new Date().toISOString(),
          subscription_cancelled_at: new Date().toISOString(),
          monthly_usage_count: 0
        }).eq('line_user_id', deletedLineUserId)

        if (deleteUserError) {
          logger.error(`[${reqId}] Failed to reset user subscription`, { error: deleteUserError })
        }

        // Subscriptionsテーブル: ステータスを expired に
        const { error: deleteSubError } = await supabase.from('subscriptions').update({
          status: 'expired',
          cancelled_at: new Date().toISOString()
        })
        .eq('user_id', deletedLineUserId)
        .in('status', ['active', 'cancelled'])

        if (deleteSubError) {
          logger.error(`[${reqId}] Failed to update subscription status`, { error: deleteSubError })
        }

        // LINE通知: サブスク終了
        try {
          const { LineApiClient } = await import('@/lib/line/client')
          const lineClient = new LineApiClient()
          await lineClient.pushMessage(deletedLineUserId, [{
            type: 'text',
            text: '📌 サブスクリプションが終了しました。\n\nご利用ありがとうございました。再度ご契約いただく場合は、メニューから「プランを見る」をタップしてください。'
          }])
          logger.info(`[${reqId}] Subscription end notification sent`, { userId: deletedLineUserId })
        } catch (e: any) {
          logger.error(`[${reqId}] Failed to send LINE deletion notice`, { error: e.message })
        }

        break
      }
    }

    return NextResponse.json({ received: true })

  } catch (error: any) {
    logger.error(`[${reqId}] Unhandled webhook error`, { error: error.message })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 })
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Stripe Webhook Endpoint is Running 🚀' })
}