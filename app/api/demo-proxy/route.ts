import { NextResponse } from 'next/server';

const DEMO_URL = 'https://syoruitemplate.netlify.app/';
const CACHE_TTL = 3600000; // 1 hour

let cachedHtml: string | null = null;
let cacheTime = 0;

export async function GET() {
  try {
    const now = Date.now();

    if (!cachedHtml || now - cacheTime > CACHE_TTL) {
      const res = await fetch(DEMO_URL, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TaskMate/1.0)',
        },
      });

      if (!res.ok) {
        return new NextResponse('Demo site unavailable', { status: 502 });
      }

      let html = await res.text();

      // Inject <base> tag so relative URLs (CSS/JS/images) resolve to the original site
      html = html.replace(
        /<head([^>]*)>/i,
        '<head$1><base href="https://syoruitemplate.netlify.app/">'
      );

      cachedHtml = html;
      cacheTime = now;
    }

    return new NextResponse(cachedHtml, {
      headers: {
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch {
    return new NextResponse('Failed to load demo', { status: 500 });
  }
}
