import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin as supabase } from '@/lib/supabase/admin'
import { logger } from '@/lib/utils/logger'
import EnvironmentValidator from '@/lib/config/environment'

export const runtime = 'edge'

/**
 * Stripe Webhook署名を検証
 */
async function verifyStripeSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    logger.error('Missing signature or secret')
    return false
  }

  try {
    const elements = signature.split(',')
    let timestamp = ''
    let signatures: string[] = []

    for (const element of elements) {
      const [key, value] = element.split('=')
      if (key === 't') {
        timestamp = value
      } else if (key === 'v1') {
        signatures.push(value)
      }
    }

    if (!timestamp || signatures.length === 0) {
      return false
    }

    const currentTime = Math.floor(Date.now() / 1000)
    const webhookTime = parseInt(timestamp, 10)
    if (Math.abs(currentTime - webhookTime) > 300) {
      logger.warn('Webhook timestamp too old', { currentTime, webhookTime })
      return false
    }

    const signedPayload = `${timestamp}.${payload}`
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature_bytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    )

    const computed = Array.from(new Uint8Array(signature_bytes))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    return signatures.some(sig => sig === computed)

  } catch (error) {
    logger.error('Signature verification error', { error })
    return false
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature')
    const webhookSecret = EnvironmentValidator.getRequired('STRIPE_WEBHOOK_SECRET')

    const isValid = await verifyStripeSignature(body, signature, webhookSecret)
    if (!isValid) {
      logger.error('Invalid Stripe signature')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.type

    logger.info('Stripe webhook received', { eventType })

    const { data: existingEvent } = await (supabase as any)
      .from('stripe_events')
      .select('id')
      .eq('event_id', event.id)
      .single()

    if (existingEvent) {
      logger.info('Duplicate webhook event, skipping', { eventId: event.id })
      return NextResponse.json({ received: true, duplicate: true })
    }

    await (supabase as any)
      .from('stripe_events')
      .insert({
        event_id: event.id,
        event_type: eventType,
        processed_at: new Date().toISOString()
      })

    switch (eventType) {
      case 'checkout.session.completed':
        const session = event.data.object
        const metadata = session.metadata || {}

        // --- 1. 違約金支払い（解約またはダウングレード）の処理 ---
        if (metadata.type === 'cancellation_fee' || metadata.type === 'downgrade_fee') {
          const userId = metadata.userId // LINE User ID
          const amountTotal = session.amount_total

          logger.info('Processing cancellation/downgrade fee payment', {
            type: metadata.type,
            userId,
            amount: amountTotal
          })

          // 決済履歴を記録
          await (supabase as any)
            .from('payment_history')
            .insert({
              user_id: userId,
              stripe_session_id: session.id,
              stripe_customer_id: session.customer,
              amount: amountTotal,
              currency: 'jpy',
              plan_type: metadata.type === 'cancellation_fee' ? 'cancellation_fee' : 'downgrade_fee',
              status: 'completed',
              paid_at: new Date().toISOString()
            })

          // Subscriptionsテーブルの更新
          if (metadata.type === 'cancellation_fee') {
            // 即時解約または期間末解約（違約金支払ったのでもう請求は止めたい）
            // ただしStripeのサブスク自体はAPIルート側でcancel_at_period_end=trueにされているはず
            // ここではDB上のステータスを更新
            await (supabase as any)
              .from('subscriptions')
              .update({
                status: 'cancelled', // 違約金払ったので解約確定
                cancellation_fee_paid: true,
                cancellation_fee_amount: amountTotal,
                cancelled_at: new Date().toISOString()
              })
              .eq('user_id', userId)
              .eq('status', 'active') // アクティブなものを対象

            // Usersテーブルも更新（後方互換）
            await (supabase as any).from('users').update({
              subscription_status: 'cancelled',
              subscription_cancelled_at: new Date().toISOString()
            }).eq('line_user_id', userId)

          } else if (metadata.type === 'downgrade_fee') {
            // ダウングレード違約金支払い完了
            // 次のプラン（Basicなど）への移行処理が必要
            // ただし、Stripe上のサブスク変更自体はまだかもしれない（API設計次第）
            // ここでは「違約金支払い済み」フラグを立てるか、あるいはここでStripe APIを叩いてプラン変更をする手もあるが
            // APIルートですでにプラン変更予約をしているなら、ここではログ記録とDB同期のみ

            const newPlanId = metadata.newPlanId

            // DB更新：プラン変更を反映（または予約状態にする）
            // 簡略化のため、ここでは「支払いが済んだのでプラン変更正当化」としてDB更新
            // ※Stripe側のサブスク変更はAPIルートで行われている前提
            await (supabase as any)
              .from('subscriptions')
              .update({
                // current_plan_id: newPlanId, // Stripe webhook customer.subscription.updated で更新されるのでここでは触らない方が安全かも
                cancellation_fee_paid: true,
                cancellation_fee_amount: amountTotal
              })
              .eq('user_id', userId)
          }

          break // 違約金処理完了
        }

        // --- 2. 通常の新規サブスクリプション登録処理 ---
        const lineUserId = session.client_reference_id
        const amountTotal = session.amount_total

        if (lineUserId) {
          let decodedLineUserId: string
          try {
            decodedLineUserId = Buffer.from(lineUserId, 'base64').toString('utf-8')
            if (!decodedLineUserId || !decodedLineUserId.match(/^U[0-9a-f]{32}$/)) {
              logger.error('Invalid LINE User ID format', { decodedLineUserId })
              return NextResponse.json({ received: true, error: 'Invalid user ID format' })
            }
          } catch (decodeError) {
            // base64でない生IDが来ている可能性も考慮（APIからの場合など）
            if (lineUserId.match(/^U[0-9a-f]{32}$/)) {
              decodedLineUserId = lineUserId
            } else {
              logger.error('Failed to decode LINE User ID', { lineUserId, error: decodeError })
              return NextResponse.json({ received: true, error: 'Decode error' })
            }
          }

          const { data: existingUser } = await (supabase as any)
            .from('users')
            .select('subscription_status, stripe_customer_id')
            .eq('line_user_id', decodedLineUserId)
            .single()

          // 重複チェック（ただし、プラン変更や違約金支払いの場合は除外）
          // 新規登録のときだけチェックしたい
          if (session.mode === 'subscription') {
            if (existingUser?.subscription_status === 'premium' || existingUser?.subscription_status === 'professional') {
              // 既に契約済みならスキップ（二重課金防止）
              // ただしStripeポータルからの操作などは別イベントで来るのでここは初期登録用
              logger.warn('User already has active subscription', { lineUserId: decodedLineUserId })
              return NextResponse.json({ received: true, alreadySubscribed: true })
            }
          }

          const subscriptionType = amountTotal >= 50000 ? 'professional' : 'premium'
          const now = new Date()

          // Usersテーブル更新（既存ロジック）
          await (supabase as any)
            .from('users')
            .update({
              subscription_status: subscriptionType,
              stripe_customer_id: session.customer,
              subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              subscription_started_at: now.toISOString(),
              payment_start_date: now.toISOString(),
              last_reset_month: 0,
              monthly_usage_count: 0
            })
            .eq('line_user_id', decodedLineUserId)

          // Subscriptionsテーブル（新テーブル）への新規挿入
          const { error: subInsertError } = await (supabase as any)
            .from('subscriptions')
            .insert({
              user_id: decodedLineUserId,
              status: 'active',
              contract_start_date: now.toISOString(),
              current_plan_id: subscriptionType === 'professional' ? 'professional' : 'basic', // IDマッピング注意
              current_plan_price: amountTotal,
              stripe_customer_id: session.customer,
              stripe_subscription_id: session.subscription, // subscription ID
              plan_history: [{
                date: now.toISOString(),
                action: 'initial_subscription',
                plan: subscriptionType
              }]
            })

          if (subInsertError) {
            logger.error('Failed to insert into subscriptions table', { subInsertError })
          }

          // 決済履歴
          await (supabase as any)
            .from('payment_history')
            .insert({
              user_id: decodedLineUserId,
              stripe_session_id: session.id,
              stripe_customer_id: session.customer,
              amount: amountTotal,
              currency: 'jpy',
              plan_type: subscriptionType,
              status: 'completed',
              paid_at: new Date().toISOString()
            })

          // LINE通知
          try {
            const LineApiClient = (await import('@/lib/line/client')).LineApiClient
            const lineClient = new LineApiClient()
            const confirmationMessage = subscriptionType === 'professional'
              ? '🎆 決済が完了しました！\n\nプロフェッショナルプランが有効化されました。'
              : '💎 決済が完了しました！\n\nプレミアムプランが有効化されました。'

            await lineClient.pushMessage(decodedLineUserId, [{
              type: 'text',
              text: confirmationMessage
            }])
          } catch (e) {
            logger.error('Failed to send LINE message', { e })
          }
        }
        break

      case 'customer.subscription.updated':
        // プラン変更や更新の検知
        const subUpdated = event.data.object
        const customerId = subUpdated.customer

        // 価格情報の取得（どのプランになったか）
        const newPriceItem = subUpdated.items.data[0]
        const newAmount = newPriceItem.price.unit_amount
        const newInterval = newPriceItem.price.recurring.interval

        // ユーザー特定
        const { data: targetUser } = await (supabase as any)
          .from('users')
          .select('line_user_id')
          .eq('stripe_customer_id', customerId)
          .single()

        if (targetUser && subUpdated.status === 'active') {
          const planName = newAmount >= 50000 ? 'professional' : 'premium' // Mapping logic

          // Subscriptionsテーブル同期
          await (supabase as any)
            .from('subscriptions')
            .update({
              current_plan_price: newAmount,
              current_plan_id: planName, // should match config ID
              status: 'active',
              stripe_subscription_id: subUpdated.id
            })
            .eq('user_id', targetUser.line_user_id)

          // Usersテーブル同期
          await (supabase as any)
            .from('users')
            .update({ subscription_status: planName })
            .eq('line_user_id', targetUser.line_user_id)

          logger.info('Subscription updated via webhook', { userId: targetUser.line_user_id, newPlan: planName })
        }
        break

      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled':
        const subscription = event.data.object

        // Subscriptionsテーブル更新
        await (supabase as any)
          .from('subscriptions')
          .update({
            status: 'cancelled',
            cancelled_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', subscription.customer)

        // Usersテーブル更新
        await (supabase as any)
          .from('users')
          .update({
            subscription_status: 'free',
            subscription_end_date: new Date().toISOString(),
            subscription_cancelled_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', subscription.customer)

        logger.info('Subscription cancelled', { customerId: subscription.customer })
        break
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    logger.error('Stripe webhook error', { error })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 })
  }
}