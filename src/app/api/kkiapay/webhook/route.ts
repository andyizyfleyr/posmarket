import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { activateSubscription } from '@/lib/subscription';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';
import { kkiapayConfigured, verifyKkiapayWebhookSecret, verifyKkiapayTransaction, KkiapayTransactionStatus } from '@/lib/kkiapay';
import { notify, getAdminEmails } from '@/lib/notifications';

export async function POST(request: Request) {
  if (!kkiapayConfigured()) {
    return NextResponse.json({ error: 'Kkiapay non configuré' }, { status: 503 });
  }

  const signature = request.headers.get('x-kkiapay-secret');
  if (!verifyKkiapayWebhookSecret(signature)) {
    return NextResponse.json({ error: 'Signature webhook invalide' }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalide' }, { status: 400 });
  }

  const p = payload as { event?: string; isPaymentSucces?: boolean; partnerId?: string; transactionId?: string; amount?: number; [key: string]: unknown };
  const event = String(p.event || '').trim();
  const isSuccess = p.isPaymentSucces === true || event === 'transaction.success';
  const kTxId = String(p.transactionId || '').trim();
  const partnerId = String(p.partnerId || '').trim();

  if (!kTxId || (!partnerId && event !== '')) {
    return NextResponse.json({ error: 'transactionId ou partnerId manquant' }, { status: 400 });
  }

  try {
    if (isSuccess) {
      const rows = await db.select().from(subscriptionPayments)
        .where(and(
          partnerId ? eq(subscriptionPayments.transactionId, partnerId) : eq(subscriptionPayments.reference, kTxId),
          eq(subscriptionPayments.status, 'PENDING'),
        ))
        .limit(10);

      if (rows.length === 0) {
        return NextResponse.json({ ok: false, message: 'Aucune facture en attente trouvée' }, { status: 200 });
      }

      for (const row of rows) {
        try {
          const tx = await verifyKkiapayTransaction(kTxId);
          const expectedStatus = tx.status === 'SUCCESS' ? 'APPROVED' : 'DECLINED';

          await db.update(subscriptionPayments)
            .set({ status: expectedStatus, reference: kTxId, updatedAt: new Date() })
            .where(and(
              eq(subscriptionPayments.transactionId, row.transactionId!),
              eq(subscriptionPayments.status, 'PENDING'),
            ));

          if (tx.status === 'SUCCESS') {
            await activateSubscription(row.userId, row.tier as SubscriptionTier, row.duration as SubscriptionDuration);
          }
        } catch (innerErr) {
          console.error(`[Kkiapay webhook] Erreur traitement ligne ${row.transactionId}:`, innerErr);
        }
      }
      return NextResponse.json({ ok: true, status: 'processed' });
    } else {
      const rows = await db.select().from(subscriptionPayments)
        .where(
          partnerId
            ? and(eq(subscriptionPayments.transactionId, partnerId), eq(subscriptionPayments.status, 'PENDING'))
            : and(eq(subscriptionPayments.reference, kTxId), eq(subscriptionPayments.status, 'PENDING')),
        )
        .limit(10);
      for (const row of rows) {
        await db.update(subscriptionPayments)
          .set({ status: 'DECLINED', reference: kTxId, updatedAt: new Date() })
          .where(and(
            eq(subscriptionPayments.transactionId, row.transactionId!),
            eq(subscriptionPayments.status, 'PENDING'),
          ));
      }

      const admins = await getAdminEmails();
      for (const adminEmail of admins) {
        await notify({
          userId: null,
          email: adminEmail,
          eventType: 'PAIEMENT_INCIDENT',
          title: 'Paiement en erreur',
          body: `Un paiement d'abonnement Kkiapay a été refusé (transaction ${kTxId}).`,
          templateParams: [kTxId],
          emailData: { tx: kTxId, provider: 'Kkiapay' },
        }).catch(() => {});
      }

      return NextResponse.json({ ok: true, status: 'declined_processed' });
    }
  } catch (error) {
    console.error('[Kkiapay webhook] Erreur:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
