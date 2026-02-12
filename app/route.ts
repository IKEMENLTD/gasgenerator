import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const htmlPath = path.join(process.cwd(), 'public', 'lp-page.html')
const html = fs.readFileSync(htmlPath, 'utf-8')

export async function GET() {
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
