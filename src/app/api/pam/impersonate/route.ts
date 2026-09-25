import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const targetUrl = new URL('/pam/impersonate', request.url);
  targetUrl.search = request.nextUrl.search;
  return NextResponse.redirect(targetUrl, 307);
}

export async function POST(request: NextRequest) {
  const targetUrl = new URL('/pam/impersonate', request.url);
  return NextResponse.redirect(targetUrl, 307);
}
