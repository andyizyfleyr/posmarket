import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { SUBSCRIPTION_PLANS } from '@/constants';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';
import { activateSubscription } from '@/lib/subscription';
import { paydunyaConfigured, verifyPayDunyaHash } from '@/lib/paydunya';

const STATUS_MAP: Record<string, string> = {
  completed: 'APPROVED',
  cancelled: 'CANCELED',
  failed: 'DECLINED',
};

const VALID_DURATIONS = ['monthly', 'quarterly', 'annual'];

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!paydunyaConfigured()) {
    return NextResponse.json({ error: 'PayDunya non configuré' }, { status: 503 });
  }

  let data: Record<string, unknown>;
  try {
    const form = new URLSearchParams(rawBody);
    const dataRaw = form.get('data') || '';
    data = JSON.parse(dataRaw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload IPN invalide' }, { status: 400 });
  }

  const hash = String(data.hash || '');
  if (!verifyPayDunyaHash(hash)) {
    return NextResponse.json({ error: 'Hash PayDunya invalide' }, { status: 400 });
  }

  const status = STATUS_MAP[String(data.status || '').toLowerCase()];
  if (!status) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const transactionId = String(data.token || '');
  if (!transactionId) {
    return NextResponse.json({ error: 'token manquant' }, { status: 400 });
  }

  try {
    if (status === 'APPROVED') {
      const custom = (data.custom_data || {}) as Record<string, unknown>;
      const userId = String(custom.userId || '');
      const tier = String(custom.tier || '');
      const duration = String(custom.duration || '');

      const tierOk = tier in SUBSCRIPTION_PLANS;
      const durationOk = VALID_DURATIONS.includes(duration);

      if (!userId || !tierOk || !durationOk) {
        return NextResponse.json({ error: 'custom_data subscription invalide' }, { status: 400 });
      }

      const inserted = await db.update(subscriptionPayments)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(and(eq(subscriptionPayments.transactionId, transactionId), ne(subscriptionPayments.status, 'APPROVED')))
        .returning({ id: subscriptionPayments.id, userId: subscriptionPayments.userId });

      if (inserted.length > 0) {
        await activateSubscription(userId, tier as SubscriptionTier, duration as SubscriptionDuration);
        revalidatePath('/subscription');
        console.log(`[PayDunya] Abonnement activé: user=${userId} tier=${tier} duration=${duration} invoice=${transactionId}`);
      } else {
        const fallback = await db.insert(subscriptionPayments).values({
          userId,
          tier,
          duration,
          amount: 0,
          currency: 'XOF',
          transactionId,
          status: 'APPROVED',
        }).onConflictDoNothing({ target: subscriptionPayments.transactionId }).returning({ id: subscriptionPayments.id });

        if (fallback.length > 0) {
          await activateSubscription(userId, tier as SubscriptionTier, duration as SubscriptionDuration);
          revalidatePath('/subscription');
          console.log(`[PayDunya] Abonnement activé (IPN seul): user=${userId} tier=${tier} duration=${duration} invoice=${transactionId}`);
        } else {
          console.log(`[PayDunya] IPN completed déjà traitée: ${transactionId}`);
        }
      }
    } else {
      await db.update(subscriptionPayments)
        .set({ status, updatedAt: new Date() })
        .where(eq(subscriptionPayments.transactionId, transactionId));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[PayDunya] webhook error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}