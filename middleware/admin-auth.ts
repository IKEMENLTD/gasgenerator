import { NextRequest, NextResponse } from 'next/server'
import * as crypto from 'crypto'

const ADMIN_API_KEY = process.env.ADMIN_API_KEY
const ADMIN_API_SECRET = process.env.ADMIN_API_SECRET

export function verifyAdminAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false
  }

  const token = authHeader.substring(7)

  try {
    const [apiKey, timestamp, signature] = token.split('.')

    if (!apiKey || !timestamp || !signature) {
      return false
    }

    if (apiKey !== ADMIN_API_KEY) {
      return false
    }

    const timestampNum = parseInt(timestamp)
    const now = Date.now()
    const fiveMinutes = 5 * 60 * 1000

    if (Math.abs(now - timestampNum) > fiveMinutes) {
      return false
    }

    const expectedSignature = crypto
      .createHmac('sha256', ADMIN_API_SECRET!)
      .update(`${apiKey}.${timestamp}`)
      .digest('base64')
      .replace(/[+/=]/g, '')

    return signature === expectedSignature
  } catch {
    return false
  }
}

export function adminAuthMiddleware(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    return handler(request, ...args)
  }
}