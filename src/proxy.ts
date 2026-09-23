import { type NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { updateSession } from '@/utils/supabase/middleware'

const { auth } = NextAuth(authConfig)

// Bots agressifs (scrapers SEO, outils d'audit, scripts) — les crawlers
// des moteurs principaux (Googlebot, Bingbot…) sont autorisés pour le SEO.
const BAD_BOT_RE =
  /(semrush|ahrefs|majestic|dotbot|petalbot|mj12bot|screaming ?frog|buzzsumo|megaindex|linkpad|serpstat|python-requests|python-urllib|scrapy|curl\/|wget|httpclient|okhttp|go-http-client|libwww|axios\/|node-fetch|java\/|apache-httpclient|zgrab|masscan|nikto|sqlmap)/i;

export function proxy(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BAD_BOT_RE.test(ua)) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'content-type': 'text/plain' },
      });
    }
    return auth((req) => updateSession(req, req.auth?.user?.id))(
      request,
      undefined as never,
    )
  } catch (e) {
    console.error('Proxy Error:', e);
    return;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}