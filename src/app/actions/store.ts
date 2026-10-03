'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { dbFetchStores, dbFetchStoreData, dbCreateStore, StoreDataFields } from '@/db/api'
import { db } from '@/db'
import { stores, profiles } from '@/db/schema'
import { eq, count, inArray } from 'drizzle-orm'
import { SubscriptionTier, SubscriptionDuration, SubscriptionTierStatus } from '@/types'
import { getSubscriptionPlan, SUBSCRIPTION_PLANS } from '@/constants'
import { createClient } from '@/utils/supabase/server'
import { requireStoreAccess, authorizeSeller } from '@/lib/authorization'

export async function fetchStores() {
  try {
    // Borné aux boutiques de l'appelant : cette action renvoyait la totalité de
    // la table `stores` (boutiques en attente comprises, avec email, téléphone
    // et NINEA) à n'importe quel visiteur.
    const access = await authorizeSeller();
    if (!access.ok) return { success: false, error: access.error };
    const storesList = await db
      .select()
      .from(stores)
      .where(inArray(stores.id, access.storeIds.length > 0 ? access.storeIds : ['']));
    return { success: true, stores: storesList };
  } catch (error: unknown) {
    console.error('Error fetching stores with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function fetchStoreData(storeId: string, ownerId?: string, fields?: StoreDataFields) {
  try {
    // Sans ce contrôle, un vendeur authentifié pouvait lire les produits,
    // commandes, clients et factures d'une boutique concurrente en passant son
    // identifiant en argument.
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { store: null, products: [], orders: [], customers: [], invoices: [], subscription: null, error: access.error } as never;

    const data = await dbFetchStoreData(storeId, ownerId, fields);
    
    return {
      products: data.products,
      orders: data.orders,
      customers: data.customers,
      invoices: data.invoices,
      store: data.store,
      subscription: data.profile ? {
        tier: (data.profile.subscriptionTier || 'NONE') as SubscriptionTier,
        duration: (data.profile.subscriptionDuration || 'monthly') as SubscriptionDuration,
        status: (data.profile.subscriptionStatus || 'NONE') as SubscriptionTierStatus,
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
  } catch (error: unknown) {
    console.error('Error fetching store data with Drizzle:', error);
    return {
      products: [],
      orders: [],
      customers: [],
      invoices: [],
      store: null,
      subscription: null,
      errors: { general: error instanceof Error ? error.message : String(error) }
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
    const tier = (profile?.subscriptionTier || 'NONE') as SubscriptionTier;
    const plan = getSubscriptionPlan(tier) || SUBSCRIPTION_PLANS.STARTER;
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

    revalidatePath('/dashboard');
    updateTag('marketplace');
    return { success: true, store: newStore };
  } catch (error: unknown) {
    console.error('Error creating store with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Delete a store — with safety checks.
 */
export async function quickDeleteStoreAction(storeId: string) {
  try {
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { success: false, error: access.error };

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

    revalidatePath('/dashboard');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting store with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function clearStoreCookieAction() {
  const { cookies } = await import('next/headers');
  (await cookies()).delete('currentStoreId');
  revalidatePath('/dashboard');
  return { success: true };
}
