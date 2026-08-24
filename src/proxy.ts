import { type NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/middleware'

// Bots agressifs (scrapers SEO, outils d'audit, scripts) — les crawlers
// des moteurs principaux (Googlebot, Bingbot…) sont autorisés pour le SEO.
const BAD_BOT_RE =
  /(semrush|ahrefs|majestic|dotbot|petalbot|mj12bot|screaming ?frog|buzzsumo|megaindex|linkpad|serpstat|python-requests|python-urllib|scrapy|curl\/|wget|httpclient|okhttp|go-http-client|libwww|axios\/|node-fetch|java\/|apache-httpclient|zgrab|masscan|nikto|sqlmap)/i;

export async function proxy(request: NextRequest) {
  try {
    const ua = request.headers.get('user-agent') || '';
    if (!ua || BAD_BOT_RE.test(ua)) {
      return new Response('Forbidden', {
        status: 403,
        headers: { 'content-type': 'text/plain' },
      });
    }
    return await updateSession(request)
  } catch (e) {
    console.error('Proxy Error:', e);
    return;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
