import { db } from '@/db'
import { profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SubscriptionTier, SubscriptionDuration } from '@/types'
import { SUBSCRIPTION_PLANS } from '@/constants'

export function isPayableTier(tier: SubscriptionTier): tier is keyof typeof SUBSCRIPTION_PLANS {
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