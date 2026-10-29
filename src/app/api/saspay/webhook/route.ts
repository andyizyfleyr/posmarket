import { NextResponse } from 'next/server';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { loadPaymentConfig } from '@/lib/paymentConfig';
import {
  findSaspayCheckoutForPayment,
  isSaspayId,
  saspayConfigured,
  verifySaspayWebhookSignature,
} from '@/lib/saspay';
import { reconcileSaspaySubscription } from '@/lib/saspaySubscriptions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

/** Limite aussi les requêtes chunked sans Content-Length avant leur mise en mémoire. */
async function readBody(request: Request): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 65_536) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function POST(request: Request) {
  try {
    const config = await loadPaymentConfig();
    if (!saspayConfigured(config.saspayApiKey) || !config.saspayWebhookSecret) {
      return NextResponse.json({ error: 'Webhook SasPay non configuré.' }, { status: 503 });
    }
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > 65_536) return NextResponse.json({ error: 'Requête trop volumineuse.' }, { status: 413 });
    const rawBody = await readBody(request);
    if (!rawBody) return NextResponse.json({ error: 'Requête trop volumineuse.' }, { status: 413 });
    if (!verifySaspayWebhookSignature(
      rawBody,
      request.headers.get('x-webhook-signature'),
      request.headers.get('x-webhook-timestamp'),
      config.saspayWebhookSecret,
    )) {
      return NextResponse.json({ error: 'Signature webhook SasPay invalide.' }, { status: 401 });
    }

    let payload: { event?: unknown; data?: { id?: unknown } };
    try {
      payload = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      return NextResponse.json({ error: 'JSON invalide.' }, { status: 400 });
    }
    if (!payload || typeof payload.event !== 'string') {
      return NextResponse.json({ error: 'Événement invalide.' }, { status: 400 });
    }
    const headerEvent = request.headers.get('x-webhook-event');
    if (headerEvent && headerEvent !== payload.event) {
      return NextResponse.json({ error: 'Événement incohérent.' }, { status: 400 });
    }
    if (payload.event !== 'transaction.success') {
      // transaction.failed peut être suivie d'une nouvelle tentative dans le
      // checkout. webhook.test permet de valider la configuration du secret.
      return NextResponse.json({ ok: true });
    }
    const paymentId = payload.data?.id;
    if (!isSaspayId(paymentId)) return NextResponse.json({ error: 'Transaction invalide.' }, { status: 400 });

    // Les doublons déjà rapprochés sont acquittés sans nouvel appel à l'API.
    const [existing] = await db.select({ id: subscriptionPayments.id })
      .from(subscriptionPayments).where(eq(subscriptionPayments.saspayPaymentId, paymentId)).limit(1);
    if (existing) return NextResponse.json({ ok: true });

    // Le payload SasPay ne contient pas l'identifiant de session. La liste
    // officielle des checkouts payés permet le rapprochement ; le cron et la
    // consultation de l'abonnement couvrent les sessions non encore visibles.
    const session = await findSaspayCheckoutForPayment(config.saspayApiKey, paymentId);
    // La liste peut être mise à jour après le webhook : demander un nouvel
    // essai plutôt que d'acquitter définitivement un événement introuvable.
    if (!session) return NextResponse.json({ ok: false, status: 'pending_reconciliation' }, { status: 503 });
    const findPayment = () => db.select({ transactionId: subscriptionPayments.transactionId })
      .from(subscriptionPayments)
      .where(and(eq(subscriptionPayments.provider, 'saspay'), eq(subscriptionPayments.saspayCheckoutId, session.id)))
      .limit(1);
    let [payment] = await findPayment();
    if (!payment && session.localTransactionId) {
      // Si la BD a été indisponible juste après la création du checkout,
      // son metadata permet de rattacher l'id à la facture encore en attente.
      [payment] = await db.update(subscriptionPayments)
        .set({ saspayCheckoutId: session.id, updatedAt: new Date() })
        .where(and(
          eq(subscriptionPayments.provider, 'saspay'),
          eq(subscriptionPayments.status, 'PENDING'),
          eq(subscriptionPayments.transactionId, session.localTransactionId),
          isNull(subscriptionPayments.saspayCheckoutId),
        )).returning({ transactionId: subscriptionPayments.transactionId });
      if (!payment) [payment] = await findPayment(); // rattachement concurrent
    }
    if (!payment?.transactionId) return NextResponse.json({ ok: true, status: 'unrelated' });

    const result = await reconcileSaspaySubscription({
      transactionId: payment.transactionId,
      expectedPaymentId: paymentId,
      apiKey: config.saspayApiKey,
    });
    return NextResponse.json({ ok: true, status: result });
  } catch {
    // Un 5xx permet à SasPay de retenter sans exposer de secret ou de payload.
    console.error('[SasPay webhook] Traitement impossible, nouvelle tentative attendue.');
    return NextResponse.json({ ok: false, error: 'Traitement temporairement indisponible.' }, { status: 503 });
  }
}
