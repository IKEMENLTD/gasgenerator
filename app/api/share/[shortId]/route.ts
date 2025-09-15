/**
 * コード共有取得APIエンドポイント
 * GET /api/share/[shortId]
 */

import { NextRequest, NextResponse } from 'next/server'
import { CodeShareQueries } from '@/lib/supabase/code-share-queries'
import { logger } from '@/lib/utils/logger'
import { ShareErrorCode, type GetCodeShareResponse } from '@/types/code-share'
import * as bcrypt from 'bcryptjs'

interface RouteParams {
  params: {
    shortId: string
  }
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { shortId } = params

  try {
    // 短縮IDのバリデーション
    if (!shortId || shortId.length !== 8) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid share ID',
          errorCode: ShareErrorCode.INVALID_SHORT_ID
        },
        { status: 400 }
      )
    }

    // コード共有を取得
    const codeShare = await CodeShareQueries.getByShortId(shortId)

    if (!codeShare) {
      return NextResponse.json(
        {
          success: false,
          error: 'Share not found',
          errorCode: ShareErrorCode.NOT_FOUND
        },
        { status: 404 }
      )
    }

    // 有効期限チェック
    const now = new Date()
    const expiresAt = new Date(codeShare.expires_at)
    if (expiresAt < now) {
      return NextResponse.json(
        {
          success: false,
          error: 'This share has expired',
          errorCode: ShareErrorCode.EXPIRED
        },
        { status: 410 }
      )
    }

    // パスワード保護チェック
    if (codeShare.password_hash) {
      const password = req.headers.get('x-password')
      if (!password) {
        return NextResponse.json(
          {
            success: false,
            error: 'Password required',
            errorCode: ShareErrorCode.PASSWORD_REQUIRED
          },
          { status: 401 }
        )
      }

      // パスワード検証
      const isPasswordValid = await bcrypt.compare(password, codeShare.password_hash)
      if (!isPasswordValid) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid password',
            errorCode: ShareErrorCode.INVALID_PASSWORD
          },
          { status: 401 }
        )
      }
    }

    // 最大閲覧回数チェック
    if (codeShare.max_views && codeShare.view_count >= codeShare.max_views) {
      return NextResponse.json(
        {
          success: false,
          error: 'Maximum views reached',
          errorCode: ShareErrorCode.MAX_VIEWS_REACHED
        },
        { status: 429 }
      )
    }

    // アクセス情報を取得
    const userAgent = req.headers.get('user-agent') || undefined
    const referer = req.headers.get('referer') || undefined
    const ipAddress = req.headers.get('x-forwarded-for') ||
                     req.headers.get('x-real-ip') ||
                     undefined

    // デバイスタイプを判定
    let deviceType: 'mobile' | 'desktop' | 'tablet' | undefined
    if (userAgent) {
      if (/mobile/i.test(userAgent)) {
        deviceType = 'mobile'
      } else if (/tablet|ipad/i.test(userAgent)) {
        deviceType = 'tablet'
      } else {
        deviceType = 'desktop'
      }
    }

    // 閲覧回数をインクリメント（非同期で実行）
    CodeShareQueries.incrementViewCount(shortId, {
      user_agent: userAgent,
      referer,
      ip_address: ipAddress,
      device_type: deviceType
    }).catch(error => {
      logger.warn('Failed to increment view count', { shortId, error })
    })

    // 関連コードを取得（オプション）
    let relatedCodes: any[] = []
    try {
      const related = await CodeShareQueries.getRelatedShares(codeShare.id)
      relatedCodes = related
        .filter(r => r.id !== codeShare.id)
        .map(r => ({
          id: r.id,
          shortId: r.short_id,
          title: r.title,
          relationType: r.parent_id === codeShare.id ? 'child' :
                       codeShare.parent_id === r.id ? 'parent' : 'sibling'
        }))
    } catch (error) {
      logger.warn('Failed to fetch related codes', { error })
    }

    // レスポンスを構築
    const response: GetCodeShareResponse = {
      success: true,
      data: {
        title: codeShare.title,
        description: codeShare.description,
        code: codeShare.code_content,
        language: codeShare.language,
        fileName: codeShare.file_name,
        createdAt: new Date(codeShare.created_at).toISOString(),
        updatedAt: new Date(codeShare.updated_at).toISOString(),
        expiresAt: new Date(codeShare.expires_at).toISOString(),
        viewCount: codeShare.view_count,
        copyCount: codeShare.copy_count,
        isExpired: false,
        isPremium: codeShare.is_premium,
        tags: codeShare.tags || [],
        author: {
          isPremium: codeShare.is_premium
        },
        relatedCodes: relatedCodes.length > 0 ? relatedCodes : undefined
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    logger.error('Failed to get code share', { shortId, error })

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
 * コピー回数をインクリメント
 * POST /api/share/[shortId]/copy
 */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { shortId } = params

  try {
    await CodeShareQueries.incrementCopyCount(shortId)

    return NextResponse.json({
      success: true,
      message: 'Copy count incremented'
    })

  } catch (error) {
    logger.error('Failed to increment copy count', { shortId, error })

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to track copy'
      },
      { status: 500 }
    )
  }
}

/**
 * コード共有を削除
 * DELETE /api/share/[shortId]
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { shortId } = params

  try {
    // ユーザーIDを取得（認証が必要）
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          errorCode: ShareErrorCode.UNAUTHORIZED
        },
        { status: 401 }
      )
    }

    // 削除理由を取得
    const body = await req.json().catch(() => ({}))
    const reason = body.reason

    // 削除実行
    await CodeShareQueries.delete(shortId, userId, reason)

    return NextResponse.json({
      success: true,
      message: 'Code share deleted'
    })

  } catch (error) {
    logger.error('Failed to delete code share', { shortId, error })

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete'
      },
      { status: 500 }
    )
  }
}