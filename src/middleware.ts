import { NextRequest, NextResponse } from 'next/server';

// Bots agressifs (scrapers SEO, outils d'audit, scripts) — les crawlers
// des moteurs principaux (Googlebot, Bingbot…) sont autorisés pour le SEO.
const BAD_BOT_RE =
  /(semrush|ahrefs|majestic|dotbot|petalbot|mj12bot|screaming ?frog|buzzsumo|megaindex|linkpad|serpstat|python-requests|python-urllib|scrapy|curl\/|wget|httpclient|okhttp|go-http-client|libwww|axios\/|node-fetch|java\/|apache-httpclient|zgrab|masscan|nikto|sqlmap)/i;

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') || '';
  if (!ua || BAD_BOT_RE.test(ua)) {
    return new NextResponse('Forbidden', {
      status: 403,
      headers: { 'content-type': 'text/plain' },
    });
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    // tout sauf assets statiques Next
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
