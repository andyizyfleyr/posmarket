'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { db } from '@/db'
import { profiles, subscriptionPayments } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SubscriptionTier, SubscriptionDuration } from '@/types'
import { SUBSCRIPTION_PLANS } from '@/constants'
import { createClient } from '@/utils/supabase/server'
import { notify, getProfilePhone } from '@/lib/notifications'
import { createFedaPayTransaction, fedapayConfigured } from '@/lib/fedapay'

function durationLabel(d: string): string {
    if (d === 'monthly') return 'mensuel';
    if (d === 'quarterly') return 'trimestriel';
    if (d === 'annual') return 'annuel';
    return d;
}

function isPayableTier(tier: SubscriptionTier): tier is keyof typeof SUBSCRIPTION_PLANS {
    return tier === 'STARTER' || tier === 'PRO' || tier === 'ENTERPRISE';
}

export function subscriptionAmount(tier: SubscriptionTier, duration: SubscriptionDuration): number | null {
    if (!isPayableTier(tier)) return null;
    const plan = SUBSCRIPTION_PLANS[tier];
    if (!plan) return null;
    if (duration === 'quarterly') return plan.priceQuarterly;
    if (duration === 'annual') return plan.priceAnnual;
    return plan.priceMonthly;
}

export async function activateSubscription(userId: string, tier: SubscriptionTier, duration: SubscriptionDuration) {
    const startDate = new Date();
    const endDate = new Date();

    if (duration === 'monthly') {
        endDate.setMonth(startDate.getMonth() + 1);
    } else if (duration === 'quarterly') {
        endDate.setMonth(startDate.getMonth() + 3);
    } else if (duration === 'annual') {
        endDate.setFullYear(startDate.getFullYear() + 1);
    }

    await db.update(profiles).set({
        subscriptionTier: tier,
        subscriptionDuration: duration,
        subscriptionStartDate: startDate,
        subscriptionEndDate: endDate,
        subscriptionStatus: 'ACTIVE'
    }).where(eq(profiles.id, userId));
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
            eventType: 'ABONNEMENT_ACTIVE',
            title: 'Abonnement activé',
            body: `Votre abonnement ${tier} (${duration}) est actif. Bienvenue parmi les commerçants PosMarket !`,
            templateParams: [String(tier), durationLabel(duration)],
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

        if (!fedapayConfigured()) {
            return { success: false, code: 'NOT_CONFIGURED', error: 'Le paiement en ligne n\'est pas encore configuré.' };
        }

        const plan = isPayableTier(tier) ? SUBSCRIPTION_PLANS[tier] : undefined;
        const amount = subscriptionAmount(tier, duration);
        if (!plan || !amount || amount <= 0) {
            return { success: false, error: `Formule d\'abonnement ${tier} invalide` };
        }

        const headerList = await headers();
        const host = headerList.get('x-forwarded-host') || headerList.get('host') || 'localhost:3000';
        const proto = headerList.get('x-forwarded-proto') || 'http';
        const origin = `${proto}://${host}`;

        const result = await createFedaPayTransaction({
            description: `Abonnement PosMarket ${plan.name} (${durationLabel(duration)})`,
            amount,
            currency: 'XOF',
            callbackUrl: `${origin}/subscription?fedapay=return`,
            metadata: { userId: user.id, tier, duration },
            customer: { email: user.email || undefined },
        });

        if (!result.paymentUrl) {
            return { success: false, error: 'Le lien de paiement FedaPay n\'a pas pu être généré. Réessayez et vérifiez la configuration de l\'API.' };
        }

        await db.insert(subscriptionPayments).values({
            userId: user.id,
            tier,
            duration,
            amount,
            currency: 'XOF',
            transactionId: result.transactionId,
            reference: result.reference || null,
            status: 'PENDING',
        }).onConflictDoNothing({ target: subscriptionPayments.transactionId });

        return { success: true, paymentUrl: result.paymentUrl, transactionId: result.transactionId };
    } catch (error: unknown) {
        console.error('Error creating subscription payment:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}