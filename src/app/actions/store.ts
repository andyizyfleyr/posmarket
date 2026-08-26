'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { dbFetchStores, dbFetchStoreData, dbCreateStore, StoreDataFields } from '@/db/api'
import { db } from '@/db'
import { stores, profiles } from '@/db/schema'
import { eq, count } from 'drizzle-orm'
import { SubscriptionTier, SubscriptionDuration } from '@/types'
import { SUBSCRIPTION_PLANS } from '@/constants'
import { createClient } from '@/utils/supabase/server'

export async function fetchStores() {
  try {
    const storesList = await dbFetchStores();
    return { success: true, stores: storesList };
  } catch (error: any) {
    console.error('Error fetching stores with Drizzle:', error);
    return { success: false, error: error.message };
  }
}

export async function fetchStoreData(storeId: string, ownerId?: string, fields?: StoreDataFields) {
  try {
    const data = await dbFetchStoreData(storeId, ownerId, fields);
    
    return {
      products: data.products,
      orders: data.orders,
      customers: data.customers,
      invoices: data.invoices,
      store: data.store,
      subscription: data.profile ? {
        tier: (data.profile.subscriptionTier || 'PRO') as SubscriptionTier,
        duration: (data.profile.subscriptionDuration || 'monthly') as SubscriptionDuration,
        status: (data.profile.subscriptionStatus || 'ACTIVE') as 'ACTIVE' | 'EXPIRED' | 'CANCELLED',
        startDate: (data.profile.subscriptionStartDate || new Date()).toISOString(),
        endDate: (data.profile.subscriptionEndDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)).toISOString()
      } : null,
      errors: {
        products: null,
        orders: null,
        customers: null,
        invoices: null,
        store: null
      }
    };
  } catch (error: any) {
    console.error('Error fetching store data with Drizzle:', error);
    return {
      products: [],
      orders: [],
      customers: [],
      invoices: [],
      store: null,
      subscription: null,
      errors: { general: error.message }
    };
  }
}

/**
 * Quick store creation from the navbar — only needs a name.
 */
export async function quickCreateStoreAction(name: string, businessType: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Non authentifié' };

    // Check store limit based on subscription tier
    const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
    const tier = (profile?.subscriptionTier || 'PRO') as SubscriptionTier;
    const plan = SUBSCRIPTION_PLANS[tier] || SUBSCRIPTION_PLANS.PRO;
    const maxStores = plan.features.maxStores;

    const [{ value: currentStoreCount }] = await db
      .select({ value: count() })
      .from(stores)
      .where(eq(stores.userId, user.id));

    if (currentStoreCount >= maxStores) {
      return { success: false, error: `Limite de ${maxStores} boutique(s) atteinte pour votre abonnement ${plan.name}. Passez à un plan supérieur pour créer plus de boutiques.` };
    }

    const newStore = await dbCreateStore(user.id, name, businessType);

    const { cookies } = await import('next/headers');
    (await cookies()).set('currentStoreId', newStore.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });

    revalidatePath('/', 'layout');
    updateTag('marketplace');
    return { success: true, store: newStore };
  } catch (error: any) {
    console.error('Error creating store with Drizzle:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a store — with safety checks.
 */
export async function quickDeleteStoreAction(storeId: string) {
  try {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!store) {
      return { success: false, error: 'Boutique introuvable.' };
    }

    const [{ value: storeCount }] = await db
      .select({ value: count() })
      .from(stores)
      .where(eq(stores.userId, store.userId));

    if (storeCount <= 1) {
      return { success: false, error: 'Vous devez avoir au moins une boutique.' };
    }

    await db.delete(stores).where(eq(stores.id, storeId));

    revalidatePath('/', 'layout');
    updateTag('marketplace');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting store with Drizzle:', error);
    return { success: false, error: error.message };
  }
}

export async function clearStoreCookieAction() {
  const { cookies } = await import('next/headers');
  (await cookies()).delete('currentStoreId');
  revalidatePath('/', 'layout');
  return { success: true };
}
