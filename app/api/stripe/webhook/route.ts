import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

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
    const webhookTime = parseInt(timestamp)
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
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

    // 署名検証を必須にする
    if (!webhookSecret) {
      logger.critical('STRIPE_WEBHOOK_SECRET is not configured - rejecting all webhooks for security')
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
    }

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
    
    switch (eventType) {
      case 'checkout.session.completed':
        // 決済完了時の処理
        const session = event.data.object
        const lineUserId = session.client_reference_id // URLパラメータから取得
        
        logger.info('Payment completed', { 
          sessionId: session.id, 
          clientReferenceId: lineUserId,
          customerId: session.customer 
        })
        
        if (lineUserId) {
          // Base64デコード
          const decodedLineUserId = Buffer.from(lineUserId, 'base64').toString('utf-8')
          
          // ユーザーのステータスを更新
          const { error } = await supabaseAdmin
            .from('users')
            .update({
              subscription_status: 'premium',
              stripe_customer_id: session.customer,
              subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            })
            .eq('line_user_id', decodedLineUserId)
          
          if (error) {
            logger.error('Failed to update user subscription', { error, lineUserId: decodedLineUserId })
          } else {
            logger.info('User subscription activated', { lineUserId: decodedLineUserId })
            
            // 決済完了メッセージをLINEで送信
            try {
              const LineApiClient = (await import('@/lib/line/client')).LineApiClient
              const lineClient = new LineApiClient()
              
              await lineClient.pushMessage(decodedLineUserId, [{
                type: 'text',
                text: '🎉 決済が完了しました！\n\n月額プランが有効化されました。\n無制限でGASコードを生成できます。\n\n「スプレッドシート操作」などのカテゴリを送信してお試しください！'
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
        // サブスクリプションキャンセル時
        const subscription = event.data.object
        
        await supabaseAdmin
          .from('users')
          .update({
            subscription_status: 'free'
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

export async function GET() {
  return NextResponse.json({ 
    status: 'OK', 
    endpoint: 'Stripe Webhook',
    timestamp: new Date().toISOString()
  })
}