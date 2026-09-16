import { NextRequest, NextResponse } from 'next/server';
import { processDueNotifications, checkSubscriptionExpirations } from '@/lib/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handleCron(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  const querySecret = request.nextUrl.searchParams.get('secret') || '';

  const authorized =
    !secret ||
    authHeader === `Bearer ${secret}` ||
    querySecret === secret;

  if (!authorized) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const due = await processDueNotifications();
    const expirations = await checkSubscriptionExpirations();
    return NextResponse.json({ ok: true, ...due, ...expirations });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCron(request);
}

export async function POST(request: NextRequest) {
  return handleCron(request);
}