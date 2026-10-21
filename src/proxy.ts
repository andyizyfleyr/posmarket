import { type NextRequest } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import { updateSession } from '@/utils/supabase/middleware'
import { enforceApiRateLimit } from '@/lib/api-rate-limit'

const { auth } = NextAuth(authConfig)

// Bots agressifs (scrapers SEO, outils d'audit, scripts) — les crawlers
// des moteurs principaux (Googlebot, Bingbot…) sont autorisés pour le SEO.
const BAD_BOT_RE =
  /(semrush|ahrefs|majestic|dotbot|petalbot|mj12bot|screaming ?frog|buzzsumo|megaindex|linkpad|serpstat|python-requests|python-urllib|scrapy|curl\/|wget|httpclient|okhttp|go-http-client|libwww|axios\/|node-fetch|java\/|apache-httpclient|zgrab|masscan|nikto|sqlmap)/i;

export async function proxy(request: NextRequest) {
  try {
    // Limitation de débit : appliquée en premier, avant toute session, pour
    // protéger l'API même des requêtes non authentifiées.
    if (request.nextUrl.pathname.startsWith('/api/')) {
      const limited = await enforceApiRateLimit(request)
      if (limited) return limited
    }

    // L'application mobile (React Native/OkHttp) envoie un User-Agent qui
    // ressemble à celui de bots ; elle s'identifie avec cet en-tête dédié
    // pour ne pas être bloquée par le filtre ci-dessous.
    const isMobileApp =
      request.headers.get('x-posmarket-client') === 'mobile-app';
    const ua = request.headers.get('user-agent') || '';
    if (!isMobileApp && (!ua || BAD_BOT_RE.test(ua))) {
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