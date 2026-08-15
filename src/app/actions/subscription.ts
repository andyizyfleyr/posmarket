'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SubscriptionTier, SubscriptionDuration } from '@/types'

export async function updateSubscriptionAction(tier: SubscriptionTier, duration: SubscriptionDuration) {
    try {
        const defaultUserId = '00000000-0000-0000-0000-000000000000';
        
        const startDate = new Date();
        let endDate = new Date();
        
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
        }).where(eq(profiles.id, defaultUserId));
        
        revalidatePath('/subscription');
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating subscription with Drizzle:', error);
        return { success: false, error: error.message };
    }
}
