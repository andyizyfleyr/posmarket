import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const userId = request.cookies.get('userId')?.value

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith('/dashboard') ||
    request.nextUrl.pathname.startsWith('/pos') ||
    request.nextUrl.pathname.startsWith('/inventory') ||
    request.nextUrl.pathname.startsWith('/customers') ||
    request.nextUrl.pathname.startsWith('/orders') ||
    request.nextUrl.pathname.startsWith('/reports') ||
    request.nextUrl.pathname.startsWith('/settings') ||
    request.nextUrl.pathname.startsWith('/subscription') ||
    request.nextUrl.pathname.startsWith('/invoices') ||
    request.nextUrl.pathname.startsWith('/admin')

  if (!userId && isProtectedRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return NextResponse.next({ request })
}
