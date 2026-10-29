import { NextRequest, NextResponse } from 'next/server';
import { syncKkiapaySubscriptions } from '@/lib/subscriptionSync';
import { syncSaspaySubscriptions } from '@/lib/saspaySubscriptions';
import { loadPaymentConfig } from '@/lib/paymentConfig';
import { isAuthorizedCronRequest } from '@/lib/cron-auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handleCron(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = await loadPaymentConfig();
    const result = await syncKkiapaySubscriptions();
    const saspay = await syncSaspaySubscriptions(config.saspayApiKey);
    return NextResponse.json({ ok: true, ...result, saspay });
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
