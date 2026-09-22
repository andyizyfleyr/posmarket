'use server'

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { SubscriptionTier, SubscriptionDuration } from '@/types';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { createClient } from '@/utils/supabase/server';
import { notify, getProfilePhone, getProfileEmail } from '@/lib/notifications';
import { eq, and } from 'drizzle-orm';
import { activateSubscription, subscriptionAmount, isPayableTier } from '@/lib/subscription';
import { kkiapayConfigured, verifyKkiapayTransaction, initKkiapayConfig, KKIAPAY_PUBLIC_KEY } from '@/lib/kkiapay';
import { fedapayConfigured, verifyFedapayTransaction, initFedapayConfig, FEDAPAY_PUBLIC_KEY, FEDAPAY_ENV_VALUE } from '@/lib/fedapay';
import { loadPaymentConfig } from '@/lib/paymentConfig';

function durationLabel(d: string): string {
    if (d === 'monthly') return 'mensuel';
    if (d === 'quarterly') return 'trimestriel';
    if (d === 'annual') return 'annuel';
    return d;
}

export async function updateSubscriptionAction(tier: SubscriptionTier, duration: SubscriptionDuration) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Utilisateur non authentifié' };
        }
        await activateSubscription(user.id, tier, duration);
        await notify({
            userId: user.id,
            phone: await getProfilePhone(user.id),
            email: await getProfileEmail(user.id),
            eventType: 'ABONNEMENT_ACTIVE',
            title: 'Abonnement activé',
            body: `Votre abonnement ${tier} (${duration}) est actif. Bienvenue parmi les commerçants PosMarket !`,
            templateParams: [String(tier), durationLabel(duration)],
            emailData: { tier, duration: durationLabel(duration) },
        });
        revalidatePath('/subscription');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error updating subscription:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function createSubscriptionPaymentAction(tier: SubscriptionTier, duration: SubscriptionDuration) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, error: 'Utilisateur non authentifié' };
        }
        const config = await loadPaymentConfig();
        if (config.provider === 'fedapay') {
          if (!fedapayConfigured()) {
            return { success: false, code: 'NOT_CONFIGURED', error: 'Le paiement FedaPay n\'est pas encore configuré.' };
          }
        } else {
          if (!kkiapayConfigured()) {
            return { success: false, code: 'NOT_CONFIGURED', error: 'Le paiement en ligne n\'est pas encore configuré.' };
          }
        }
        const plan = isPayableTier(tier) ? SUBSCRIPTION_PLANS[tier] : undefined;
        const amount = subscriptionAmount(tier, duration);
        if (!plan || !amount || amount <= 0) {
            return { success: false, error: `Formule d'abonnement ${tier} invalide` };
        }

        const transactionId = randomUUID();
        await db.insert(subscriptionPayments).values({
            userId: user.id,
            tier,
            duration,
            amount,
            currency: 'XOF',
            transactionId,
            reference: '',
            status: 'PENDING',
            createdAt: new Date(),
            updatedAt: new Date(),
        }).onConflictDoNothing({ target: subscriptionPayments.transactionId });

        return { success: true, transactionId, amount };
    } catch (error: unknown) {
        console.error('Error creating subscription payment:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function confirmKkiapayPaymentAction(
    transactionId: string,
    kkiapayTransactionId: string,
) {
    try {
        const config = await loadPaymentConfig();
        if (config.provider !== 'kkiapay') {
            return { success: false, error: 'Le fournisseur de paiement actif est FedaPay, non Kkiapay.' };
        }
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, code: 'Unauthorized', error: 'Utilisateur non authentifié' };
        }
        if (!kkiapayConfigured()) {
            return { success: false, error: 'Le paiement Kkiapay n\'est pas encore configuré.' };
        }

        const kTxId = String(kkiapayTransactionId || '').trim();
        if (!kTxId) {
            return { success: false, error: 'Référence de transaction Kkiapay manquante.' };
        }

        const rows = await db
            .select()
            .from(subscriptionPayments)
            .where(
                and(
                    eq(subscriptionPayments.transactionId, String(transactionId).trim()),
                    eq(subscriptionPayments.userId, user.id),
                ),
            )
            .limit(1);
        const payment = rows[0];
        if (!payment || payment.status !== 'PENDING') {
            return { success: false, error: 'Facture introuvable ou déjà traitée.' };
        }

        const tx = await verifyKkiapayTransaction(kTxId);
        if (tx.status !== 'SUCCESS') {
            const msg = tx.failureMessage || tx.reason || 'Le paiement n\'a pas abouti.';
            return { success: false, error: msg };
        }

        const paidAmount = Number(tx.amount);
        const expectedAmount = Number(payment.amount);
        if (paidAmount !== expectedAmount) {
            return { success: false, error: 'Le montant payé ne correspond pas à la facture.' };
        }

        await db
            .update(subscriptionPayments)
            .set({ status: 'APPROVED', reference: kTxId, updatedAt: new Date() })
            .where(
                and(
                    eq(subscriptionPayments.transactionId, transactionId),
                    eq(subscriptionPayments.status, 'PENDING'),
                ),
            );

        await activateSubscription(
            payment.userId,
            payment.tier as SubscriptionTier,
            payment.duration as SubscriptionDuration,
        );
        revalidatePath('/subscription');

        return { success: true, message: 'Paiement vérifié. Abonnement activé.' };
    } catch (error: unknown) {
        console.error('Error confirming Kkiapay payment:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function confirmFedapayPaymentAction(
    transactionId: string,
    fedapayTransactionId: string | number,
) {
    try {
        const config = await loadPaymentConfig();
        if (config.provider !== 'fedapay') {
            return { success: false, error: 'Le fournisseur de paiement actif est Kkiapay, non FedaPay.' };
        }
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return { success: false, code: 'Unauthorized', error: 'Utilisateur non authentifié' };
        }
        if (!fedapayConfigured()) {
            return { success: false, error: 'Le paiement FedaPay n\'est pas encore configuré.' };
        }

        const fTxId = String(fedapayTransactionId || '').trim();
        if (!fTxId) {
            return { success: false, error: 'Référence de transaction FedaPay manquante.' };
        }

        const rows = await db
            .select()
            .from(subscriptionPayments)
            .where(
                and(
                    eq(subscriptionPayments.transactionId, String(transactionId).trim()),
                    eq(subscriptionPayments.userId, user.id),
                ),
            )
            .limit(1);
        const payment = rows[0];
        if (!payment || payment.status !== 'PENDING') {
            return { success: false, error: 'Facture introuvable ou déjà traitée.' };
        }

        const tx = await verifyFedapayTransaction(fTxId);
        const status = String((tx.status || '').toLowerCase());
        const isApproved = ['approved', 'success', 'transferred', 'completed'].includes(status);
        if (!isApproved) {
            console.warn('[FedaPay Verification] Transaction not approved:', { status, fTxId, tx });
            return { success: false, error: `Le paiement n'a pas abouti (statut FedaPay : ${status || 'inconnu'}).` };
        }

        const paidAmount = Number(tx.amount);
        const expectedAmount = Number(payment.amount);
        if (paidAmount && expectedAmount && Math.abs(paidAmount - expectedAmount) > 1) {
            console.error('[FedaPay Verification] Amount mismatch:', { paidAmount, expectedAmount, tx });
            return { success: false, error: `Le montant payé (${paidAmount}) ne correspond pas à la facture (${expectedAmount}).` };
        }

        await db
            .update(subscriptionPayments)
            .set({ status: 'APPROVED', reference: fTxId, updatedAt: new Date() })
            .where(
                and(
                    eq(subscriptionPayments.transactionId, transactionId),
                    eq(subscriptionPayments.status, 'PENDING'),
                ),
            );

        await activateSubscription(
            payment.userId,
            payment.tier as SubscriptionTier,
            payment.duration as SubscriptionDuration,
        );

        await notify({
            userId: user.id,
            phone: await getProfilePhone(user.id),
            email: await getProfileEmail(user.id),
            eventType: 'ABONNEMENT_ACTIVE',
            title: 'Abonnement activé',
            body: `Votre abonnement ${payment.tier} (${payment.duration}) a été validé avec succès via FedaPay.`,
            templateParams: [String(payment.tier), durationLabel(payment.duration)],
            emailData: { tier: payment.tier, duration: durationLabel(payment.duration) },
        });

        revalidatePath('/subscription');

        return { success: true, message: 'Paiement FedaPay vérifié. Abonnement activé.' };
    } catch (error: unknown) {
        console.error('Error confirming FedaPay payment:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
