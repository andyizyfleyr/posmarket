'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';
import { SubscriptionTier, SubscriptionDuration } from '@/types';

/**
 * Calculer les statistiques globales réelles
 */
export async function getGlobalStats() {
    const supabase = await createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');
    
    const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single();
    if (!profile?.is_super_admin) throw new Error('Forbidden');

    const [
        { count: totalStores },
        { count: totalUsers },
        { data: allOrders },
        { count: totalProducts },
        { count: pendingStores }
    ] = await Promise.all([
        supabase.from('stores').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('orders').select('total'),
        supabase.from('products').select('*', { count: 'exact', head: true }),
        supabase.from('stores').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
    ]);

    const totalSales = allOrders?.reduce((acc, order) => acc + (order.total || 0), 0) || 0;

    return {
        totalStores: totalStores || 0,
        totalUsers: totalUsers || 0,
        totalSales,
        totalProducts: totalProducts || 0,
        pendingStores: pendingStores || 0
    };
}

/**
 * Récupérer toutes les boutiques avec les infos réelles des proprios
 */
export async function getAllStores() {
    const supabase = await createClient();
    
    // Tentative de jointure via profiles (lié par user_id dans stores)
    const { data: stores, error } = await supabase
        .from('stores')
        .select(`
            *,
            profiles:user_id (
              email, 
              full_name
            )
        `)
        .order('created_at', { ascending: false });

    if (error) {
        console.warn("[Admin Action] Join failed, falling back to basic fetch:", error.message);
        const { data: simpleStores } = await supabase.from('stores').select('*').order('created_at', { ascending: false });
        return simpleStores || [];
    }
    
    return stores || [];
}

/**
 * Récupérer tous les profils réels
 */
export async function getAllUsers() {
    const supabase = await createClient();
    const { data: users, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    return users || [];
}

/**
 * Récupérer l'inventaire global réel
 */
export async function getGlobalProducts(limit = 100) {
    const supabase = await createClient();
    
    const { data: products, error } = await supabase
        .from('products')
        .select(`
            *,
            stores (name)
        `)
        .limit(limit)
        .order('created_at', { ascending: false });

    if (error) throw error;
    return products || [];
}

/**
 * Récupérer l'historique global réel des commandes
 */
export async function getGlobalOrders(limit = 100) {
    const supabase = await createClient();
    
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            *,
            stores (name)
        `)
        .limit(limit)
        .order('date', { ascending: false });

    if (error) throw error;
    return orders || [];
}

export async function updateUserAdminStatus(userId: string, isSuperAdmin: boolean) {
    const supabase = await createClient();
    const { error } = await supabase.from('profiles').update({ is_super_admin: isSuperAdmin }).eq('id', userId);
    if (error) throw error;
    revalidatePath('/admin');
    return { success: true };
}

export async function updateUserSubscription(userId: string, tier: SubscriptionTier, duration: SubscriptionDuration) {
    const supabase = await createClient();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + 1);

    const { error } = await supabase.from('profiles').update({ 
        subscription_tier: tier,
        subscription_duration: duration,
        subscription_end_date: endDate.toISOString()
    }).eq('id', userId);

    if (error) throw error;
    revalidatePath('/admin');
    return { success: true };
}

export async function deleteStoreAdmin(storeId: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('stores').delete().eq('id', storeId);
    if (error) throw error;
    revalidatePath('/admin');
    return { success: true };
}

export async function updateStoreStatusAction(storeId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'DISABLED') {
    const supabase = await createClient();
    const { error } = await supabase.from('stores').update({ status }).eq('id', storeId);
    if (error) throw error;
    revalidatePath('/admin');
    revalidatePath('/dashboard');
    return { success: true };
}
