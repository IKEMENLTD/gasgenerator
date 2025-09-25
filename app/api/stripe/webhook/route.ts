import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
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
    // Stripe-Signature format: t=timestamp,v1=signature
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

    // タイムスタンプが5分以内かチェック（リプレイ攻撃防止）
    const currentTime = Math.floor(Date.now() / 1000)
    const webhookTime = parseInt(timestamp, 10)
    if (Math.abs(currentTime - webhookTime) > 300) {
      logger.warn('Webhook timestamp too old', { currentTime, webhookTime })
      return false
    }

    // 署名を計算
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

    // 計算した署名と比較
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
    // Stripe Webhook Secretは必須（起動時にチェック済み）
    const webhookSecret = EnvironmentValidator.getRequired('STRIPE_WEBHOOK_SECRET')

    const isValid = await verifyStripeSignature(body, signature, webhookSecret)
    if (!isValid) {
      logger.error('Invalid Stripe signature - possible security breach attempt', {
        signature: signature?.substring(0, 20) + '...',
        ip: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip')
      })
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }

    const event = JSON.parse(body)
    const eventType = event.type
    
    logger.info('Stripe webhook received', { eventType })
    
    // 重複処理防止のためのイベントID確認
    const { data: existingEvent } = await (supabaseAdmin as any)
      .from('stripe_events')
      .select('id')
      .eq('event_id', event.id)
      .single()
    
    if (existingEvent) {
      logger.info('Duplicate webhook event, skipping', { eventId: event.id })
      return NextResponse.json({ received: true, duplicate: true })
    }
    
    // イベントを記録（トランザクション的処理の代替）
    await (supabaseAdmin as any)
      .from('stripe_events')
      .insert({
        event_id: event.id,
        event_type: eventType,
        processed_at: new Date().toISOString()
      })
    
    switch (eventType) {
      case 'checkout.session.completed':
        // 決済完了時の処理
        const session = event.data.object
        const lineUserId = session.client_reference_id // URLパラメータから取得
        const amountTotal = session.amount_total // 支払い金額を取得

        logger.info('Payment completed', {
          sessionId: session.id,
          clientReferenceId: lineUserId,
          customerId: session.customer,
          amountTotal: amountTotal
        })
        
        if (lineUserId) {
          // Base64デコード（エラーハンドリング付き）
          let decodedLineUserId: string
          try {
            decodedLineUserId = Buffer.from(lineUserId, 'base64').toString('utf-8')
            // LINE User IDの形式チェック（Uで始まる33文字）
            if (!decodedLineUserId || !decodedLineUserId.match(/^U[0-9a-f]{32}$/)) {
              logger.error('Invalid LINE User ID format', { decodedLineUserId })
              return NextResponse.json({ received: true, error: 'Invalid user ID format' })
            }
          } catch (decodeError) {
            logger.error('Failed to decode LINE User ID', { lineUserId, error: decodeError })
            return NextResponse.json({ received: true, error: 'Decode error' })
          }
          
          // まず既存のユーザーを確認（line_user_idでユーザーを特定）
          const { data: existingUser } = await (supabaseAdmin as any)
            .from('users')
            .select('subscription_status, stripe_customer_id')
            .eq('line_user_id', decodedLineUserId)
            .single()
          
          // 既にプレミアムまたはプロフェッショナルの場合はスキップ（重複課金防止）
          if (existingUser?.subscription_status === 'premium' || existingUser?.subscription_status === 'professional') {
            logger.warn('User already has active subscription', {
              lineUserId: decodedLineUserId,
              currentStatus: existingUser?.subscription_status
            })
            return NextResponse.json({ received: true, alreadySubscribed: true })
          }
          
          // 支払い金額に基づいてプランを判定
          // Professional: 50,000円, Premium: 10,000円
          const subscriptionType = amountTotal >= 50000 ? 'professional' : 'premium'

          // ユーザーのステータスを更新（決済日を基準に1ヶ月更新）
          const now = new Date()
          const { error } = await (supabaseAdmin as any)
            .from('users')
            .update({
              subscription_status: subscriptionType,
              stripe_customer_id: session.customer,
              subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
              subscription_started_at: now.toISOString(),
              payment_start_date: now.toISOString(),  // 決済日を記録（月次更新の基準）
              last_reset_month: 0,  // リセット月数を初期化
              monthly_usage_count: 0  // 使用回数もリセット
            })
            .eq('line_user_id', decodedLineUserId)  // line_user_idで正しくユーザーを特定
          
          if (error) {
            logger.error('Failed to update user subscription', { error, lineUserId: decodedLineUserId })
          } else {
            logger.info('User subscription activated', {
              lineUserId: decodedLineUserId,
              subscriptionType,
              amountTotal
            })
            
            // 決済完了メッセージをLINEで送信
            try {
              const LineApiClient = (await import('@/lib/line/client')).LineApiClient
              const lineClient = new LineApiClient()
              
              const confirmationMessage = subscriptionType === 'professional'
                ? '🎆 決済が完了しました！\n\nプロフェッショナルプランが有効化されました。\n無制限でGASコードを生成でき、優先サポートもご利用いただけます。\n\n「スプレッドシート操作」などのカテゴリを送信してお試しください！'
                : '💎 決済が完了しました！\n\nプレミアムプランが有効化されました。\n無制限でGASコードを生成できます。\n\n「スプレッドシート操作」などのカテゴリを送信してお試しください！'

              await lineClient.pushMessage(decodedLineUserId, [{
                type: 'text',
                text: confirmationMessage
              }])
            } catch (lineError) {
              logger.error('Failed to send payment confirmation', { lineError })
            }
          }
        } else {
          logger.error('Missing client_reference_id in payment session', { sessionId: session.id })
        }
        break
      
      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled':
        // サブスクリプションキャンセル時
        const subscription = event.data.object
        
        const { error: cancelError } = await (supabaseAdmin as any)
          .from('users')
          .update({
            subscription_status: 'free',
            subscription_end_date: new Date().toISOString(),
            subscription_cancelled_at: new Date().toISOString()
          })
          .eq('stripe_customer_id', subscription.customer)
        
        if (cancelError) {
          logger.error('Failed to cancel subscription', { error: cancelError, customerId: subscription.customer })
        } else {
          logger.info('Subscription cancelled', { customerId: subscription.customer })
        }
        break
      
      case 'charge.refunded':
        // 返金処理
        const charge = event.data.object
        
        // 返金記録を保存
        await (supabaseAdmin as any)
          .from('refunds')
          .insert({
            charge_id: charge.id,
            amount: charge.amount_refunded,
            customer_id: charge.customer,
            refunded_at: new Date().toISOString()
          })
        
        // ユーザーのステータスを無料に戻す
        if (charge.customer) {
          await (supabaseAdmin as any)
            .from('users')
            .update({
              subscription_status: 'free',
              refund_processed_at: new Date().toISOString()
            })
            .eq('stripe_customer_id', charge.customer)
        }
        
        logger.info('Refund processed', { chargeId: charge.id, amount: charge.amount_refunded })
        break
    }
    
    return NextResponse.json({ received: true })
    
  } catch (error) {
    logger.error('Stripe webhook error', { error })
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 400 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    endpoint: 'Stripe Webhook',
    timestamp: new Date().toISOString()
  })
}