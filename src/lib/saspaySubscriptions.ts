import { randomUUID } from 'node:crypto';
import { after } from 'next/server';
import { and, asc, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, subscriptionPayments } from '@/db/schema';
import { getProfileEmail, getProfilePhone, notify } from '@/lib/notifications';
import { isPayableTier, subscriptionAmount } from '@/lib/subscription';
import { saspayApprovalQuery } from '@/lib/saspayApproval';
import { refreshTag } from '@/lib/revalidate';
import {
  createSaspayCheckout,
  getSaspayCheckoutStatus,
  isSaspayId,
  normalizeSaspayAmount,
  saspayConfigured,
  saspayPaymentMatches,
  saspayReturnUrl,
  SaspayApiError,
  SaspayPublicError,
  verifySaspayPayment,
} from '@/lib/saspay';
import type { SubscriptionDuration, SubscriptionTier } from '@/types';

type PaymentRow = typeof subscriptionPayments.$inferSelect;
export type SaspayReconciliation = 'approved' | 'pending' | 'failed' | 'not_found';

function durationLabel(duration: string): string {
  return duration === 'annual' ? 'annuel' : duration === 'quarterly' ? 'trimestriel' : 'mensuel';
}

/** Une facture locale est créée avant la session distante ; aucun retry automatique du POST. */
export async function createSaspaySubscriptionPayment(
  userId: string,
  tier: SubscriptionTier,
  duration: SubscriptionDuration,
  apiKey: string,
) {
  if (!saspayConfigured(apiKey)) throw new SaspayPublicError('Le paiement SasPay n’est pas encore configuré.');
  if (!['monthly', 'quarterly', 'annual'].includes(duration) || !isPayableTier(tier)) {
    throw new SaspayPublicError('Formule ou durée d’abonnement invalide.');
  }
  const amount = subscriptionAmount(tier, duration);
  if (!amount || !Number.isSafeInteger(amount) || amount <= 0) throw new SaspayPublicError('Montant d’abonnement invalide.');

  const [profile] = await db.select({ email: profiles.email, fullName: profiles.fullName })
    .from(profiles).where(eq(profiles.id, userId)).limit(1);
  const email = profile?.email?.trim() || '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SaspayPublicError('Une adresse email valide est nécessaire pour payer avec SasPay.');
  }
  const transactionId = randomUUID();
  const returnUrl = saspayReturnUrl(transactionId);

  await db.insert(subscriptionPayments).values({
    userId, tier, duration, amount, currency: 'XOF', transactionId,
    reference: '', status: 'PENDING', provider: 'saspay',
  });

  let stage: 'provider' | 'persistence' = 'provider';
  try {
    const checkout = await createSaspayCheckout(apiKey, {
      amount,
      transactionId,
      tier,
      duration,
      customerEmail: email,
      customerName: profile?.fullName?.trim() || email.split('@')[0] || 'Client PosMarket',
      returnUrl,
    });
    stage = 'persistence';
    await db.update(subscriptionPayments)
      .set({ saspayCheckoutId: checkout.id, updatedAt: new Date() })
      .where(and(eq(subscriptionPayments.transactionId, transactionId), eq(subscriptionPayments.provider, 'saspay')));
    return { success: true as const, transactionId, amount, paymentUrl: checkout.checkoutUrl, returnUrl };
  } catch (error) {
    // Diagnostic strictement catégoriel : aucune clé, URL, donnée client ou
    // réponse de l'API ne doit apparaître dans les journaux.
    console.error('[SasPay] Initialisation impossible', {
      stage,
      reason: error instanceof SaspayApiError ? error.reason : 'internal',
      status: error instanceof SaspayApiError ? error.status : null,
    });
    // Un refus 4xx est définitif ; une panne ou un timeout peut masquer une
    // session créée. Conserver alors la facture pour un éventuel webhook.
    const definitive = error instanceof SaspayApiError && [400, 401, 403, 404, 422, 429].includes(error.status);
    if (definitive) {
      await db.update(subscriptionPayments).set({ status: 'DECLINED', updatedAt: new Date() })
        .where(and(eq(subscriptionPayments.transactionId, transactionId), eq(subscriptionPayments.status, 'PENDING')));
      throw error;
    }
    throw new SaspayPublicError('La création du paiement n’a pas pu être confirmée. Vérifiez votre abonnement ou contactez le support avant de payer à nouveau.');
  }
}

function scheduleActivationNotification(payment: PaymentRow) {
  try {
    after(async () => {
      refreshTag('marketplace');
      try {
        const [phone, email] = await Promise.all([getProfilePhone(payment.userId), getProfileEmail(payment.userId)]);
        await notify({
          userId: payment.userId,
          phone,
          email,
          eventType: 'ABONNEMENT_ACTIVE',
          title: 'Abonnement activé',
          body: `Votre abonnement ${payment.tier} (${durationLabel(payment.duration)}) a été validé avec succès via SasPay.`,
          templateParams: [payment.tier, durationLabel(payment.duration)],
          emailData: { tier: payment.tier, duration: durationLabel(payment.duration) },
        });
      } catch {
        console.error('[SasPay] Notification d’activation impossible.');
      }
    });
  } catch {
    // L'activation est déjà atomiquement persistée, même hors contexte Next.
    console.error('[SasPay] Planification de la notification impossible.');
  }
}

/**
 * Rapprochement serveur : facture locale → session créée par nous → paiement
 * vérifié auprès de SasPay. Le changement d'état ET l'activation sont une
 * seule instruction SQL atomique, même en cas de webhook/retour simultanés.
 */
export async function reconcileSaspaySubscription(options: {
  transactionId: string;
  apiKey: string;
  userId?: string;
  expectedPaymentId?: string;
}): Promise<SaspayReconciliation> {
  if (!isSaspayId(options.transactionId)) return 'not_found';
  const conditions = [
    eq(subscriptionPayments.transactionId, options.transactionId),
    eq(subscriptionPayments.provider, 'saspay'),
  ];
  if (options.userId) conditions.push(eq(subscriptionPayments.userId, options.userId));
  const [payment] = await db.select().from(subscriptionPayments).where(and(...conditions)).limit(1);
  if (!payment) return 'not_found';
  if (payment.status === 'APPROVED') {
    return !options.expectedPaymentId || payment.saspayPaymentId === options.expectedPaymentId ? 'approved' : 'not_found';
  }
  if (payment.status !== 'PENDING') return 'failed';
  if (!payment.saspayCheckoutId) return 'pending';
  if (!saspayConfigured(options.apiKey)) throw new SaspayPublicError('Le paiement SasPay n’est pas encore configuré.');

  const session = await getSaspayCheckoutStatus(options.apiKey, payment.saspayCheckoutId);
  if (session.status === 'EXPIRED' || session.status === 'CANCELLED') {
    const changed = await db.update(subscriptionPayments)
      .set({ status: 'DECLINED', updatedAt: new Date() })
      .where(and(eq(subscriptionPayments.id, payment.id), eq(subscriptionPayments.status, 'PENDING')))
      .returning({ id: subscriptionPayments.id });
    if (changed.length) return 'failed';
    // Une autre requête a pu approuver la facture entre-temps.
    const [current] = await db.select({ status: subscriptionPayments.status }).from(subscriptionPayments)
      .where(eq(subscriptionPayments.id, payment.id)).limit(1);
    return current?.status === 'APPROVED' ? 'approved' : 'failed';
  }
  // Un paiement FAILED peut être rejoué sur le même checkout : ne pas le
  // considérer comme définitivement refusé tant que la session est ouverte.
  if (session.status !== 'PAID' || !session.transaction_id) return 'pending';
  const verified = await verifySaspayPayment(options.apiKey, session.transaction_id);
  if (verified.status === 'PENDING') return 'pending';
  if (!saspayPaymentMatches(session, verified, {
    sessionId: payment.saspayCheckoutId,
    amount: payment.amount,
    currency: payment.currency,
    paymentId: options.expectedPaymentId,
  })) {
    throw new SaspayPublicError('Le paiement SasPay ne correspond pas à la facture ou n’est pas confirmé.');
  }
  if (!isPayableTier(payment.tier as SubscriptionTier) || !['monthly', 'quarterly', 'annual'].includes(payment.duration)) {
    throw new SaspayPublicError('Formule ou durée de la facture invalide.');
  }

  const charged = normalizeSaspayAmount(verified.debited_amount);
  const net = normalizeSaspayAmount(verified.net_amount);
  const feeMode = verified.fee_charge_mode === 'ADD_ON' || verified.fee_charge_mode === 'DEDUCTED'
    ? verified.fee_charge_mode : null;
  const result = await db.execute(saspayApprovalQuery({
    rowId: payment.id,
    checkoutId: payment.saspayCheckoutId,
    paymentId: verified.id,
    charged,
    net,
    feeMode,
  }));
  if (result.rows.length > 0) {
    scheduleActivationNotification(payment);
    return 'approved';
  }
  const [current] = await db.select({ status: subscriptionPayments.status, paymentId: subscriptionPayments.saspayPaymentId })
    .from(subscriptionPayments).where(eq(subscriptionPayments.id, payment.id)).limit(1);
  return current?.status === 'APPROVED' && current.paymentId === verified.id ? 'approved' : 'pending';
}

/** Filet de sécurité pour les webhooks manqués et les clients qui ne reviennent pas. */
export async function syncSaspaySubscriptions(apiKey: string, userId?: string) {
  const summary = { scanned: 0, activated: 0, pending: 0, failed: 0, errors: 0 };
  if (!saspayConfigured(apiKey)) return summary;
  const conditions = [
    eq(subscriptionPayments.provider, 'saspay'),
    eq(subscriptionPayments.status, 'PENDING'),
    isNotNull(subscriptionPayments.saspayCheckoutId),
  ];
  if (userId) conditions.push(eq(subscriptionPayments.userId, userId));
  const rows = await db.select().from(subscriptionPayments).where(and(...conditions))
    .orderBy(asc(subscriptionPayments.updatedAt)).limit(userId ? 5 : 25);

  // Lots bornés pour rester sous la limite de 300 requêtes/minute de SasPay.
  for (let i = 0; i < rows.length; i += 5) {
    const outcomes = await Promise.all(rows.slice(i, i + 5).map(async row => {
      if (!row.transactionId) return { result: 'not_found' as const, rateLimited: false };
      try {
        const result = await reconcileSaspaySubscription({ transactionId: row.transactionId, apiKey, userId });
        if (result === 'pending') {
          await db.update(subscriptionPayments).set({ updatedAt: new Date() })
            .where(and(eq(subscriptionPayments.id, row.id), eq(subscriptionPayments.status, 'PENDING')));
        }
        return { result, rateLimited: false };
      } catch (error) {
        console.error('[SasPay] Vérification d’une facture en attente impossible.');
        // Une facture en erreur ne doit pas bloquer indéfiniment les suivantes.
        await db.update(subscriptionPayments).set({ updatedAt: new Date() })
          .where(and(eq(subscriptionPayments.id, row.id), eq(subscriptionPayments.status, 'PENDING')))
          .catch(() => undefined);
        return { result: 'error' as const, rateLimited: error instanceof SaspayApiError && error.status === 429 };
      }
    }));
    for (const outcome of outcomes) {
      summary.scanned++;
      if (outcome.result === 'approved') summary.activated++;
      else if (outcome.result === 'pending') summary.pending++;
      else if (outcome.result === 'failed') summary.failed++;
      else summary.errors++;
    }
    if (outcomes.some(outcome => outcome.rateLimited)) break;
  }
  return summary;
}
