'use server';

import { db } from '@/db';
import { stores, profiles, orders, products } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';

export async function getGlobalStats() {
    try {
        const [
            [{ count: totalStores }],
            [{ count: totalUsers }],
            allOrders,
            [{ count: totalProducts }],
        ] = await Promise.all([
            db.select({ count: sql<number>`count(*)` }).from(stores),
            db.select({ count: sql<number>`count(*)` }).from(profiles),
            db.select({ total: orders.total }).from(orders),
            db.select({ count: sql<number>`count(*)` }).from(products),
        ]);

        const totalSales = (allOrders || []).reduce((acc: number, order: any) => acc + (parseFloat(order.total) || 0), 0);

        return {
            totalStores: Number(totalStores) || 0,
            totalUsers: Number(totalUsers) || 0,
            totalSales,
            totalProducts: Number(totalProducts) || 0,
            pendingStores: 0
        };
    } catch (error: any) {
        console.error('Error fetching global stats with Drizzle:', error);
        return { totalStores: 0, totalUsers: 0, totalSales: 0, totalProducts: 0, pendingStores: 0 };
    }
}

export async function getAllStores() {
    try {
        const storesList = await db.select().from(stores).orderBy(desc(stores.createdAt));
        return storesList || [];
    } catch (error: any) {
        console.error('Error fetching all stores with Drizzle:', error);
        return [];
    }
}

export async function getAllUsers() {
    try {
        const usersList = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
        return usersList || [];
    } catch (error: any) {
        console.error('Error fetching all users with Drizzle:', error);
        return [];
    }
}

export async function getGlobalProducts(limit = 100) {
    try {
        const productsList = await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
        return productsList || [];
    } catch (error: any) {
        console.error('Error fetching global products with Drizzle:', error);
        return [];
    }
}

export async function updateStoreApproval(storeId: string, status: string) {
    try {
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateUserRole(userId: string, isSuperAdmin: boolean) {
    try {
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function forceDeleteStore(storeId: string) {
    try {
        await db.delete(stores).where(eq(stores.id, storeId));
        revalidatePath('/admin');
        updateTag('marketplace');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Additional Admin exports expected by AdminView
export async function updateUserAdminStatus(userId: string, isAdmin: boolean) {
    return updateUserRole(userId, isAdmin);
}

export async function updateUserSubscription(userId: string, tier: string, duration: string) {
    try {
        await db.update(profiles).set({ subscriptionTier: tier, subscriptionDuration: duration }).where(eq(profiles.id, userId));
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteStoreAdmin(storeId: string) {
    return forceDeleteStore(storeId);
}

export async function getGlobalOrders() {
    try {
        const ordersList = await db.select().from(orders).orderBy(desc(orders.date)).limit(100);
        return ordersList || [];
    } catch (error: any) {
        return [];
    }
}

export async function updateStoreStatusAction(storeId: string, status: string) {
    return updateStoreApproval(storeId, status);
}
