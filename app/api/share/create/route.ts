/**
 * コード共有作成APIエンドポイント
 * POST /api/share/create
 */

import { NextRequest, NextResponse } from 'next/server'
import { CodeShareQueries } from '@/lib/supabase/code-share-queries'
import { logger } from '@/lib/utils/logger'
import { z } from 'zod'
import type { CreateCodeShareRequest, CreateCodeShareResponse } from '@/types/code-share'

// リクエストスキーマ
const createShareSchema = z.object({
  code: z.string().min(1).max(100000), // 100KB制限
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  userId: z.string().min(1),
  jobId: z.string().optional(), // TEXT型なのでUUID検証を外す
  sessionId: z.string().optional(), // TEXT型なのでUUID検証を外す
  parentId: z.string().uuid().optional(), // こちらはUUID型のまま
  requirements: z.record(z.any()).optional(),
  conversationContext: z.record(z.any()).optional(),
  options: z.object({
    password: z.string().min(6).max(100).optional(),
    maxViews: z.number().int().positive().optional(),
    expiresInDays: z.number().int().min(1).max(365).optional(),
    tags: z.array(z.string()).optional()
  }).optional()
})

export async function POST(req: NextRequest) {
  try {
    // リクエストボディを取得
    const body = await req.json()

    // バリデーション
    const validatedData = createShareSchema.parse(body) as CreateCodeShareRequest

    // ユーザーのプレミアムステータスを確認（仮実装）
    // TODO: 実際のプレミアムチェックロジックを実装
    const isPremium = await checkUserPremiumStatus(validatedData.userId)

    // 有効期限を決定（無料: 7日、プレミアム: 30日）
    const expiresInDays = validatedData.options?.expiresInDays || (isPremium ? 30 : 7)

    // コード共有を作成
    const codeShare = await CodeShareQueries.create({
      userId: validatedData.userId,
      code: validatedData.code,
      title: validatedData.title,
      description: validatedData.description,
      jobId: validatedData.jobId,
      sessionId: validatedData.sessionId,
      parentId: validatedData.parentId,
      requirements: validatedData.requirements,
      conversationContext: validatedData.conversationContext,
      expiresInDays,
      isPremium,
      password: validatedData.options?.password,
      maxViews: validatedData.options?.maxViews,
      tags: validatedData.options?.tags
    })

    // URLを生成
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://gasgenerator.onrender.com'
    const shareUrl = `${baseUrl}/s/${codeShare.short_id}`

    // QRコードを生成（オプション）
    let qrCode: string | undefined
    if (isPremium) {
      qrCode = await generateQRCode(shareUrl)
    }

    // レスポンスを返す
    const response: CreateCodeShareResponse = {
      success: true,
      data: {
        id: codeShare.id,
        shortId: codeShare.short_id,
        url: shareUrl,
        expiresAt: codeShare.expires_at.toISOString(),
        qrCode
      }
    }

    logger.info('Code share created', {
      shortId: codeShare.short_id,
      userId: validatedData.userId,
      title: validatedData.title
    })

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Failed to create code share', { error })

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validation error',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    )
  }
}

/**
 * ユーザーのプレミアムステータスを確認
 */
async function checkUserPremiumStatus(userId: string): Promise<boolean> {
  try {
    const { PremiumChecker } = await import('@/lib/premium/premium-checker')
    const status = await PremiumChecker.checkPremiumStatus(userId)
    return status.isPremium || false
  } catch (error) {
    logger.warn('Failed to check premium status', { userId, error })
    return false
  }
}

/**
 * QRコードを生成（Base64）
 */
async function generateQRCode(url: string): Promise<string | undefined> {
  try {
    // QRコード生成ライブラリを使用（別途インストール必要）
    // const QRCode = require('qrcode')
    // const qrDataUrl = await QRCode.toDataURL(url)
    // return qrDataUrl

    // 一時的に未実装
    return undefined
  } catch (error) {
    logger.warn('Failed to generate QR code', { url, error })
    return undefined
  }
}