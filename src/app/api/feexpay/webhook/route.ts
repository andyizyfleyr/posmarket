import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { activateSubscription } from '@/lib/subscription';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';
import { feexpayConfigured, verifyFeexpayWebhookSignature, verifyFeexpayTransaction } from '@/lib/feexpay';

interface FeexpayWebhookEntity {
  id?: string | number;
  transactionId?: string;
  reference?: string;
  status?: string;
  description?: string;
  partnerId?: string;
  callbackInfo?: string;
  orderId?: string;
  custom_metadata?: { partnerId?: string };
  amount?: number;
}

interface FeexpayWebhookPayload {
  name?: string;
  event?: string;
  type?: string;
  status?: string;
  partnerId?: string;
  transactionId?: string;
  entity?: FeexpayWebhookEntity;
  data?: FeexpayWebhookEntity;
}

export async function POST(request: Request) {
  if (!feexpayConfigured()) {
    return NextResponse.json({ error: 'FeexPay non configuré' }, { status: 503 });
  }

  const signature = request.headers.get('x-feexpay-signature') || request.headers.get('X-FEEXPAY-SIGNATURE');
  const rawBody = await request.text();

  if (!verifyFeexpayWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'Signature webhook FeexPay invalide' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
  }

  const p = payload as FeexpayWebhookPayload;
  const eventName = String(p.name || p.event || p.type || '').trim().toLowerCase();
  const entity: FeexpayWebhookEntity = p.entity || p.data || (payload as FeexpayWebhookEntity) || {};
  const fTxId = String(entity.id || entity.transactionId || entity.reference || p.transactionId || '').trim();

  if (!fTxId) {
    return NextResponse.json({ error: 'Identifiant de transaction FeexPay manquant' }, { status: 400 });
  }

  let partnerId = String(
    entity.custom_metadata?.partnerId ||
      entity.partnerId ||
      entity.callbackInfo ||
      entity.orderId ||
      p.partnerId ||
      ''
  ).trim();
  if (!partnerId && entity?.description) {
    const match = String(entity.description).match(/ref:\s*([a-f0-9-]+)/i);
    if (match && match[1]) partnerId = match[1].trim();
  }

  const status = String(entity?.status || p?.status || '').toLowerCase();
  const isSuccess = ['approved', 'success', 'transferred', 'completed', 'paid'].includes(status) || eventName.includes('success') || eventName.includes('approved');

  try {
    if (isSuccess) {
      const rows = await db
        .select()
        .from(subscriptionPayments)
        .where(
          and(
            partnerId ? eq(subscriptionPayments.transactionId, partnerId) : eq(subscriptionPayments.reference, fTxId),
            eq(subscriptionPayments.status, 'PENDING')
          )
        )
        .limit(10);

      if (rows.length === 0) {
        return NextResponse.json({ ok: true, message: 'Aucune facture en attente trouvée ou déjà traitée' });
      }

      const verifiedTx = await verifyFeexpayTransaction(fTxId);
      if (!['approved', 'success', 'transferred', 'completed', 'paid'].includes(verifiedTx.status)) {
        return NextResponse.json({ ok: false, message: 'Transaction non approuvée par l’API FeexPay' }, { status: 400 });
      }

      for (const row of rows) {
        try {
          const paidAmount = Number(verifiedTx.amount ?? 0);
          const expectedAmount = Number(row.amount ?? 0);
          if (paidAmount > 0 && expectedAmount > 0 && Math.abs(paidAmount - expectedAmount) > 1) {
            throw new Error(`Montant incohérent pour la facture ${row.transactionId} : ${paidAmount} != ${expectedAmount}`);
          }

          await db
            .update(subscriptionPayments)
            .set({ status: 'APPROVED', reference: fTxId, updatedAt: new Date() })
            .where(and(eq(subscriptionPayments.transactionId, row.transactionId!), eq(subscriptionPayments.status, 'PENDING')));

          await activateSubscription(row.userId, row.tier as SubscriptionTier, row.duration as SubscriptionDuration);
        } catch (innerErr) {
          console.error(`[FeexPay webhook] Erreur traitement ligne ${row.transactionId}:`, innerErr);
        }
      }
      return NextResponse.json({ ok: true, status: 'approved_processed' });
    }

    const isFailed = ['declined', 'canceled', 'cancelled', 'failed', 'error'].includes(status) || eventName.includes('declined') || eventName.includes('cancel');
    if (isFailed) {
      const rows = await db
        .select()
        .from(subscriptionPayments)
        .where(
          and(
            partnerId ? eq(subscriptionPayments.transactionId, partnerId) : eq(subscriptionPayments.reference, fTxId),
            eq(subscriptionPayments.status, 'PENDING')
          )
        )
        .limit(10);
      for (const row of rows) {
        await db
          .update(subscriptionPayments)
          .set({ status: 'DECLINED', reference: fTxId, updatedAt: new Date() })
          .where(and(eq(subscriptionPayments.transactionId, row.transactionId!), eq(subscriptionPayments.status, 'PENDING')));
      }
      return NextResponse.json({ ok: true, status: 'declined_processed' });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[FeexPay webhook] Erreur:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}