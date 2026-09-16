'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { db } from '@/db'
import { subscriptionPayments } from '@/db/schema'
import { SubscriptionTier, SubscriptionDuration } from '@/types'
import { SUBSCRIPTION_PLANS } from '@/constants'
import { createClient } from '@/utils/supabase/server'
import { notify, getProfilePhone } from '@/lib/notifications'
import { createPayDunyaInvoice, paydunyaConfigured } from '@/lib/paydunya'
import { activateSubscription, subscriptionAmount, isPayableTier } from '@/lib/subscription'

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

        if (!paydunyaConfigured()) {
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

        const customer: { name?: string; email?: string; phone?: string } = { email: user.email || undefined };
        try {
            const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single();
            if (profile?.full_name) customer.name = String(profile.full_name);
            if (profile?.phone) customer.phone = String(profile.phone);
        } catch {
            // non bloquant : le paiement fonctionne sans pré-remplissage client
        }

        const result = await createPayDunyaInvoice({
            description: `Abonnement PosMarket ${plan.name} (${durationLabel(duration)})`,
            totalAmount: amount,
            customer,
            items: [{
                name: `Abonnement ${plan.name}`,
                quantity: 1,
                unit_price: amount,
                total_price: amount,
                description: durationLabel(duration),
            }],
            customData: { userId: user.id, tier, duration },
            returnUrl: `${origin}/subscription?paydunya=return`,
            cancelUrl: `${origin}/subscription`,
            callbackUrl: `${origin}/api/paydunya/webhook`,
        });

        if (!result.paymentUrl) {
            return { success: false, error: 'Le lien de paiement PayDunya n\'a pas pu être généré. Réessayez et vérifiez la configuration de l\'API.' };
        }

        await db.insert(subscriptionPayments).values({
            userId: user.id,
            tier,
            duration,
            amount,
            currency: 'XOF',
            transactionId: result.token,
            reference: result.token,
            status: 'PENDING',
        }).onConflictDoNothing({ target: subscriptionPayments.transactionId });

        return { success: true, paymentUrl: result.paymentUrl, transactionId: result.token };
    } catch (error: unknown) {
        console.error('Error creating subscription payment:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}