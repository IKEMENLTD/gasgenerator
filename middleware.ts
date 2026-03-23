import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || ''

  // gasgenerator.onrender.com → taskmateai.net にリダイレクト
  if (hostname === 'gasgenerator.onrender.com') {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, 'https://taskmateai.net')
    return NextResponse.redirect(url, 301)
  }

  // app.taskmateai.net のルートアクセスをカタログにリダイレクト
  if (hostname === 'app.taskmateai.net' && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/systems/catalog', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // 静的ファイル・API・_nextを除外
  matcher: ['/((?!api|_next/static|_next/image|favicon\\.ico|manuals|images).*)'],
}
