import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/client'
import { logger } from '@/lib/utils/logger'

// Stripe SDK不要 - Render環境でのシンプルな実装
export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    // Stripeからのイベントタイプを確認
    const eventType = body.type
    
    logger.info('Stripe webhook received', { eventType })
    
    switch (eventType) {
      case 'checkout.session.completed':
        // 決済完了時の処理
        const session = body.data.object
        const lineUserId = session.client_reference_id // URLパラメータから取得
        
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
          }
        }
        break
      
      case 'customer.subscription.deleted':
        // サブスクリプションキャンセル時
        const subscription = body.data.object
        
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