import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { activateSubscription } from '@/lib/subscription';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';
import { loadPaymentConfig } from '@/lib/paymentConfig';
import { fedapayConfigured, verifyFedapayTransaction } from '@/lib/fedapay';

export async function POST(request: Request) {
  try {
    await loadPaymentConfig();
    if (!fedapayConfigured()) {
      return NextResponse.json({ error: 'FedaPay non configuré' }, { status: 503 });
    }

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return NextResponse.json({ error: 'Payload invalide' }, { status: 400 });
    }

    const p = payload as {
      name?: string;
      event?: string;
      entity?: {
        id?: number | string;
        amount?: number;
        status?: string;
        description?: string;
        custom_metadata?: { partnerId?: string; [key: string]: unknown };
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };

    const eventName = String(p.name || p.event || '').trim().toLowerCase();
    const entity = p.entity || {};
    const fTxId = entity.id ? String(entity.id).trim() : '';

    if (!fTxId) {
      return NextResponse.json({ error: 'Identifiant de transaction FedaPay manquant' }, { status: 400 });
    }

    // Extraction du partnerId (UUID de transactionPosMarket)
    let partnerId = entity.custom_metadata?.partnerId ? String(entity.custom_metadata.partnerId).trim() : '';
    if (!partnerId && entity.description) {
      const match = String(entity.description).match(/ref:\s*([a-f0-9-]+)/i);
      if (match && match[1]) {
        partnerId = match[1].trim();
      }
    }

    const isApproved = eventName === 'transaction.approved' || entity.status === 'approved';

    if (isApproved) {
      // Double vérification auprès de l'API FedaPay avec la clé secrète
      const verifiedTx = await verifyFedapayTransaction(fTxId);
      const verifiedStatus = String(verifiedTx.status || '').toLowerCase();
      if (verifiedStatus !== 'approved' && verifiedStatus !== 'success') {
        return NextResponse.json({ ok: false, message: 'Transaction non approuvée par l\'API FedaPay' }, { status: 400 });
      }

      const rows = await db
        .select()
        .from(subscriptionPayments)
        .where(
          and(
            partnerId ? eq(subscriptionPayments.transactionId, partnerId) : eq(subscriptionPayments.reference, fTxId),
            eq(subscriptionPayments.status, 'PENDING'),
          ),
        )
        .limit(10);

      if (rows.length === 0) {
        return NextResponse.json({ ok: true, message: 'Aucune facture en attente trouvée ou déjà traitée' });
      }

      for (const row of rows) {
        try {
          await db
            .update(subscriptionPayments)
            .set({ status: 'APPROVED', reference: fTxId, updatedAt: new Date() })
            .where(
              and(
                eq(subscriptionPayments.transactionId, row.transactionId!),
                eq(subscriptionPayments.status, 'PENDING'),
              ),
            );

          await activateSubscription(row.userId, row.tier as SubscriptionTier, row.duration as SubscriptionDuration);
        } catch (innerErr) {
          console.error(`[FedaPay webhook] Erreur traitement ligne ${row.transactionId}:`, innerErr);
        }
      }

      return NextResponse.json({ ok: true, status: 'approved_processed' });
    } else if (eventName === 'transaction.canceled' || eventName === 'transaction.declined' || entity.status === 'declined' || entity.status === 'canceled') {
      const rows = await db
        .select()
        .from(subscriptionPayments)
        .where(
          and(
            partnerId ? eq(subscriptionPayments.transactionId, partnerId) : eq(subscriptionPayments.reference, fTxId),
            eq(subscriptionPayments.status, 'PENDING'),
          ),
        )
        .limit(10);

      for (const row of rows) {
        await db
          .update(subscriptionPayments)
          .set({ status: 'DECLINED', reference: fTxId, updatedAt: new Date() })
          .where(
            and(
              eq(subscriptionPayments.transactionId, row.transactionId!),
              eq(subscriptionPayments.status, 'PENDING'),
            ),
          );
      }

      return NextResponse.json({ ok: true, status: 'declined_processed' });
    }

    return NextResponse.json({ ok: true, message: `Événement ${eventName} ignoré` });
  } catch (error) {
    console.error('[FedaPay webhook] Erreur:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
