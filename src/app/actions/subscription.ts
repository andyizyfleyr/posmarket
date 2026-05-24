'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { SubscriptionTier, SubscriptionDuration } from '@/types'

export async function updateSubscriptionAction(tier: SubscriptionTier, duration: SubscriptionDuration) {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
        return { success: false, error: 'Non authentifié' }
    }

    // 1. Calculate dates on server to prevent cheating
    const startDate = new Date();
    let endDate = new Date();
    
    if (duration === 'monthly') {
        endDate.setMonth(startDate.getMonth() + 1);
    } else if (duration === 'quarterly') {
        endDate.setMonth(startDate.getMonth() + 3);
    } else if (duration === 'annual') {
        endDate.setFullYear(startDate.getFullYear() + 1);
    }

    // 2. Perform the update
    const { error } = await supabase.from('profiles').update({
        subscription_tier: tier,
        subscription_duration: duration,
        subscription_start_date: startDate.toISOString(),
        subscription_end_date: endDate.toISOString(),
        subscription_status: 'ACTIVE'
    }).eq('id', session.user.id)
    
    if (error) {
        console.error('Error updating subscription:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/subscription')
    revalidatePath('/', 'layout')
    return { success: true }
}
