'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { profiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { SubscriptionTier, SubscriptionDuration } from '@/types'
import { createClient } from '@/utils/supabase/server'

export async function updateSubscriptionAction(tier: SubscriptionTier, duration: SubscriptionDuration) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return { success: false, error: 'Utilisateur non authentifié' };
        }

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
        }).where(eq(profiles.id, user.id));

        revalidatePath('/subscription');
        revalidatePath('/', 'layout');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating subscription:', error);
        return { success: false, error: error.message };
    }
}
