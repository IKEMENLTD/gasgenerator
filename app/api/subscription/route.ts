import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { generateUrlSignature } from '@/lib/utils/crypto'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const queryUserId = searchParams.get('userId')
        const signature = searchParams.get('signature')

        let targetUserId: string | null = null

        // 1. URL署名認証 (LINEユーザー向け)
        if (queryUserId && signature) {
            const expectedSignature = await generateUrlSignature(queryUserId)
            if (signature !== expectedSignature) {
                return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
            }
            targetUserId = queryUserId
        }

        // 2. Authorizationヘッダー認証 (Standard / Dev)
        if (!targetUserId) {
            const authHeader = req.headers.get('Authorization')
            if (authHeader) {
                const token = authHeader.replace('Bearer ', '')
                const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
                if (!authError && user) {
                    targetUserId = user.id
                }
            }
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 3. 認証されたユーザーIDでサブスクリプション情報を取得
        const { data: subscription, error: dbError } = await supabaseAdmin
            .from('subscriptions')
            .select('*')
            .eq('user_id', targetUserId)
            .eq('status', 'active')
            .maybeSingle()

        if (dbError) {
            console.error('Database error:', dbError)
            return NextResponse.json({ error: 'Database error' }, { status: 500 })
        }

        return NextResponse.json({ subscription })

    } catch (error: any) {
        console.error('API Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
