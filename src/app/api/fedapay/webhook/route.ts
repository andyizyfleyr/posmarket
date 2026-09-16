import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and, ne } from 'drizzle-orm';
import { SUBSCRIPTION_PLANS } from '@/constants';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';
import { activateSubscription } from '@/app/actions/subscription';
import { verifyWebhookSignature, webhookConfigured } from '@/lib/fedapay';

const EVENT_NAMES = ['transaction.approved', 'transaction.declined', 'transaction.canceled', 'transaction.created', 'transaction.transferred'] as const;

type WebhookEvent = {
  name?: string;
  event?: string;
  type?: string;
  object?: Record<string, unknown>;
  transaction?: Record<string, unknown>;
  [k: string]: unknown;
};

function getTransactionId(ev: WebhookEvent): string {
  const obj = (ev.object || ev.transaction || {}) as Record<string, unknown>;
  const id = String(obj.id ?? ev.id ?? '');
  return id;
}

function getStatusForName(name: string): string {
  if (name === 'transaction.approved') return 'APPROVED';
  if (name === 'transaction.declined') return 'DECLINED';
  if (name === 'transaction.canceled') return 'CANCELED';
  if (name === 'transaction.created') return 'PENDING';
  return 'PENDING';
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!webhookConfigured()) {
    return NextResponse.json({ error: 'Webhook FedaPay non configuré' }, { status: 503 });
  }

  const signature = request.headers.get('x-fedapay-signature');
  if (!signature || !verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Signature FedaPay invalide' }, { status: 400 });
  }

  let ev: WebhookEvent;
  try {
    ev = JSON.parse(rawBody) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
  }

  const name = String(ev.name || ev.event || ev.type || '');
  if (!name || !EVENT_NAMES.includes(name as (typeof EVENT_NAMES)[number])) {
    return NextResponse.json({ error: `Événement inconnu: ${name}` }, { status: 400 });
  }

  const transactionId = getTransactionId(ev);
  if (!transactionId) {
    return NextResponse.json({ error: 'transaction_id manquant' }, { status: 400 });
  }

  const status = getStatusForName(name);

  try {
    if (name === 'transaction.approved') {
      const obj = (ev.object || ev.transaction || {}) as Record<string, unknown>;
      const meta = (obj.custom_metadata || obj.metadata || {}) as Record<string, unknown>;
      const userId = String(meta.userId || '');
      const tier = String(meta.tier || '');
      const duration = String(meta.duration || '');

      const tierOk = tier in SUBSCRIPTION_PLANS;
      const durationOk = duration === 'monthly' || duration === 'quarterly' || duration === 'annual';

      if (!userId || !tierOk || !durationOk) {
        return NextResponse.json({ error: 'metadata subscription invalide' }, { status: 400 });
      }

      const inserted = await db.update(subscriptionPayments)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(and(eq(subscriptionPayments.transactionId, transactionId), ne(subscriptionPayments.status, 'APPROVED')))
        .returning({ id: subscriptionPayments.id, userId: subscriptionPayments.userId });

      if (inserted.length > 0) {
        await activateSubscription(userId, tier as SubscriptionTier, duration as SubscriptionDuration);
        revalidatePath('/subscription');
        console.log(`[FedaPay] Abonnement activé: user=${userId} tier=${tier} duration=${duration} tx=${transactionId}`);
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
          console.log(`[FedaPay] Abonnement activé (webhook seul): user=${userId} tier=${tier} duration=${duration} tx=${transactionId}`);
        } else {
          console.log(`[FedaPay] transaction.approved déjà traitée: ${transactionId}`);
        }
      }
    } else {
      await db.update(subscriptionPayments)
        .set({ status, updatedAt: new Date() })
        .where(eq(subscriptionPayments.transactionId, transactionId));
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error('[FedaPay] webhook error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'method_not_allowed' }, { status: 405 });
}