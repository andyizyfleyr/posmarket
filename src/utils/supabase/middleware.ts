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

  const isProtectedRoute = PROTECTED_PREFIXES.some((p) =>
    request.nextUrl.pathname.startsWith(p),
  )

  if (!userId && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
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