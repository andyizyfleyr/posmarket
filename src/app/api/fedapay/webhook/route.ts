import { NextResponse } from 'next/server';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { activateSubscription } from '@/lib/subscription';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';
import { loadPaymentConfig } from '@/lib/paymentConfig';
import { fedapayConfigured, verifyFedapayTransaction, verifyFedapayWebhookSignature } from '@/lib/fedapay';
import { notify, getAdminEmails, notifyPaymentFailed } from '@/lib/notifications';
import {
  confirmStorePaymentByRow,
  findStorePaymentForWebhook,
  loadStorePaymentCredential,
  markStorePaymentFailed,
} from '@/lib/store-payments';

function verifyFedapaySignatureWithSecret(payloadRaw: string, signatureHeader: string | null, secret: string): boolean {
  if (!secret || !signatureHeader) return false;
  try {
    let sig = signatureHeader;
    if (signatureHeader.includes('s=')) {
      const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});
      sig = parts.s || parts.v1 || signatureHeader;
    }
    const hmac = createHmac('sha256', secret).update(payloadRaw).digest('hex');
    const expected = Buffer.from(hmac);
    const received = Buffer.from(sig);
    return expected.length === received.length && timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    await loadPaymentConfig();

    const signature = request.headers.get('x-fedapay-signature') || request.headers.get('X-FEDAPAY-SIGNATURE');
    const rawBody = await request.text();

    let payload: unknown;
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return NextResponse.json({ error: 'Payload JSON invalide' }, { status: 400 });
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

    // Extraction du partnerId (UUID de transactionPosMarket, ou jeton d'une
    // commande boutique transmis dans la description du widget).
    let partnerId = entity.custom_metadata?.partnerId ? String(entity.custom_metadata.partnerId).trim() : '';
    if (!partnerId && entity.description) {
      const desc = String(entity.description);
      const match = desc.match(/ref:\s*([a-f0-9-]+)/i) || desc.match(/:([A-Za-z0-9_-]{20,})\s*$/);
      if (match && match[1]) {
        partnerId = match[1].trim();
      }
    }

    const isApproved = eventName === 'transaction.approved' || entity.status === 'approved';
    const isDeclined =
      eventName === 'transaction.canceled' ||
      eventName === 'transaction.declined' ||
      entity.status === 'declined' ||
      entity.status === 'canceled';

    // --- Commandes boutique (paiements encaissés directement par les vendeurs)
    try {
      const storePayment = await findStorePaymentForWebhook('fedapay', {
        token: partnerId || null,
        reference: fTxId,
      });
      if (storePayment) {
        const secrets = await loadStorePaymentCredential(storePayment.storeId, 'fedapay');
        const storeWebhookSecret = secrets?.webhookSecret;
        if (storeWebhookSecret) {
          if (!verifyFedapaySignatureWithSecret(rawBody, signature, storeWebhookSecret)) {
            return NextResponse.json({ error: 'Signature webhook FedaPay invalide' }, { status: 401 });
          }
        }
        if (isApproved) {
          await confirmStorePaymentByRow(storePayment, fTxId);
        } else if (isDeclined && storePayment.status === 'PENDING') {
          await markStorePaymentFailed(storePayment.id, 'Paiement FedaPay refusé.');
        }
        return NextResponse.json({ ok: true, status: 'store_payment_processed' });
      }
    } catch (storeErr) {
      console.error('[FedaPay webhook] Erreur rapprochement commande boutique:', storeErr);
    }

    // --- Abonnements (guichet de la plateforme)
    if (!fedapayConfigured()) {
      return NextResponse.json({ error: 'FedaPay non configuré' }, { status: 503 });
    }

    if (!verifyFedapayWebhookSignature(rawBody, signature)) {
      return NextResponse.json({ error: 'Signature webhook FedaPay invalide' }, { status: 401 });
    }

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
        if (row.provider && row.provider !== 'fedapay') continue;
        try {
          // La transaction est rapprochée de la facture : sans cette vérification,
          // une seule transaction réellement payée pouvait faire approuver
          // toutes les factures en attente du même client (rejeu).
          const paidAmount = Number(verifiedTx.amount ?? 0);
          const expectedAmount = Number(row.amount ?? 0);
          if (paidAmount <= 0 || expectedAmount <= 0 || Math.abs(paidAmount - expectedAmount) > 1) {
            throw new Error(
              `Montant incohérent pour la facture ${row.transactionId} : ${paidAmount} ≠ ${expectedAmount}`,
            );
          }

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
    } else if (isDeclined) {
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
        if (row.provider && row.provider !== 'fedapay') continue;
        await db
          .update(subscriptionPayments)
          .set({ status: 'DECLINED', reference: fTxId, updatedAt: new Date() })
          .where(
            and(
              eq(subscriptionPayments.transactionId, row.transactionId!),
              eq(subscriptionPayments.status, 'PENDING'),
            ),
          );
        await notifyPaymentFailed({
          userId: row.userId,
          amount: row.amount,
          provider: 'FedaPay',
          reference: fTxId,
        });
      }

      const admins = await getAdminEmails();
      for (const adminEmail of admins) {
        await notify({
          userId: null,
          email: adminEmail,
          eventType: 'PAIEMENT_INCIDENT',
          title: 'Paiement en erreur',
          body: `Un paiement d'abonnement FedaPay a été refusé (transaction ${fTxId}).`,
          templateParams: [fTxId],
          emailData: { tx: fTxId, provider: 'FedaPay' },
        }).catch(() => {});
      }

      return NextResponse.json({ ok: true, status: 'declined_processed' });
    }

    return NextResponse.json({ ok: true, message: `Événement ${eventName} ignoré` });
  } catch (error) {
    console.error('[FedaPay webhook] Erreur:', error);
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
