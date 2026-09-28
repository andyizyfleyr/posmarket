import { NextResponse, type NextRequest } from 'next/server'

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/pos',
  '/inventory',
  '/customers',
  '/orders',
  '/reports',
  '/settings',
  '/subscription',
  '/invoices',
]

export async function updateSession(request: NextRequest, sessionUserId?: string | null) {
  const userId = sessionUserId || null

  const isServerAction = !!request.headers.get('next-action')
  if (isServerAction) {
    // Ne jamais rediriger/casser les POST server-actions : leur auth est
    // vérifiée côté action (session Supabase dans l'action elle-même) et
    // les pages protégées sont déjà verrouillées par leur layout.
    const res = NextResponse.next({ request })
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return res
  }

  const isProtectedRoute = PROTECTED_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  )

  if (!userId && isProtectedRoute) {
    const url = request.nextUrl.clone()
    // La destination est conservée dans `?next=` : une fois authentifié, le
    // vendeur revient sur la page qu'il visait au lieu de l'écran d'accueil
    // par défaut. Elle est ré-validée côté serveur par la page /login.
    url.pathname = '/login'
    url.search = ''
    url.searchParams.set('next', request.nextUrl.pathname)
    const res = NextResponse.redirect(url)
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    return res
  }

  const res = NextResponse.next({ request })
  if (isProtectedRoute) {
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  }
  return res
}