import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { logger } from '@/lib/utils/logger'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
    const reqId = crypto.randomUUID()
    logger.info(`[${reqId}] DEBUG WEBHOOK: Request received`)

    try {
        const headerList = headers()
        const allHeaders: Record<string, string> = {}
        headerList.forEach((value, key) => {
            allHeaders[key] = value
        })

        logger.info(`[${reqId}] DEBUG WEBHOOK: Headers`, { headers: allHeaders })

        const body = await req.text()
        logger.info(`[${reqId}] DEBUG WEBHOOK: Body size: ${body.length}`)
        logger.info(`[${reqId}] DEBUG WEBHOOK: Body preview: ${body.substring(0, 200)}...`)

        return NextResponse.json({ received: true, debug: true })
    } catch (error: any) {
        logger.error(`[${reqId}] DEBUG WEBHOOK: Error`, { error: error.message })
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

export async function GET(req: NextRequest) {
    return NextResponse.json({ status: 'Debug endpoint is working. Please send POST request.' })
}
