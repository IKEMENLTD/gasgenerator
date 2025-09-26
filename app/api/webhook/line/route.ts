import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { sendLineMessage, getLineUserProfile } from '@/lib/line-api-client'
import { handleTokenWithTransaction } from '@/lib/supabase/transaction'
import { checkAndActivatePremium } from '@/lib/premium-handler'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

const channelSecret = process.env.LINE_CHANNEL_SECRET!

function validateSignature(body: string, signature: string): boolean {
  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64')
  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-line-signature')
    if (!signature) {
      return NextResponse.json(
        { error: 'No signature' },
        { status: 401 }
      )
    }

    const rawBody = await request.text()

    if (!validateSignature(rawBody, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const body = JSON.parse(rawBody)
    const events = body.events || []

    for (const event of events) {
      if (event.type === 'follow') {
        const lineUserId = event.source.userId

        await handleFollow(lineUserId)
      } else if (event.type === 'message' && event.message.type === 'text') {
        const lineUserId = event.source.userId
        const text = event.message.text.trim()
        const upperText = text.toUpperCase()

        // Check for premium activation code (64+ characters)
        if (text.length >= 64) {
          await handlePremiumActivation(lineUserId, text)
        }
        // Check for 6-character tracking token
        else if (upperText.length === 6 && /^[A-Z0-9]+$/.test(upperText)) {
          await handleTokenMessage(lineUserId, upperText)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function handleFollow(lineUserId: string) {
  const profile = await getLineUserProfile(lineUserId)

  await supabase
    .from('user_states')
    .upsert({
      line_user_id: lineUserId,
      display_name: profile?.displayName || null,
      picture_url: profile?.pictureUrl || null,
      status_message: profile?.statusMessage || null,
      language: profile?.language || 'ja',
      state: { step: 'waiting_for_token' },
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'line_user_id'
    })

  await sendLineMessage(
    lineUserId,
    '友だち追加ありがとうございます！\n\n認証を完了するには、6文字のトークンを送信してください。\n\nトークンは招待リンクをクリックした際に表示されています。'
  )
}

async function handleTokenMessage(lineUserId: string, token: string) {
  const { data: session } = await supabase
    .from('tracking_sessions')
    .select(`
      *,
      tracking_links (*)
    `)
    .eq('auth_token', token)
    .gte('expires_at', new Date().toISOString())
    .is('line_user_id', null)
    .single()

  if (!session) {
    await sendLineMessage(lineUserId, '無効なトークンです。もう一度お試しください。')
    return
  }

  const profile = await getLineUserProfile(lineUserId)

  const success = await handleTokenWithTransaction(
    session.id,
    lineUserId,
    session.tracking_link_id,
    profile
  )

  if (!success) {
    await sendLineMessage(lineUserId, 'エラーが発生しました。もう一度お試しください。')
    return
  }

  await sendLineMessage(
    lineUserId,
    `✅ 認証が完了しました！\n\nようこそTaskMateへ！\n\n【登録情報】\n・キャンペーン: ${session.tracking_links.campaign_name}\n・参照元: ${session.tracking_links.source}\n\nこれからTaskMateをよろしくお願いします！`
  )
}

async function handlePremiumActivation(lineUserId: string, code: string) {
  const result = await checkAndActivatePremium(lineUserId, code)

  if (result.success) {
    await sendLineMessage(
      lineUserId,
      `🎉 プレミアムプラン アクティベーション成功！\n\n✨ プレミアム機能が有効になりました\n\n【特典】\n・無制限トラッキングリンク作成\n・高度な分析機能\n・API アクセス\n・優先サポート\n\n有効期限: ${result.expiresAt}\n\nプレミアムプランをお楽しみください！`
    )
  } else {
    // Silent failure - don't reveal activation attempt
    console.log(`Invalid activation attempt: ${lineUserId}`)
  }
}

