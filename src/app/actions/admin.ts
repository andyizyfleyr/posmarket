'use server';

import { db } from '@/db';
import { stores, profiles, orders, products } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';

function errorMessage(error: unknown): string {
  return error instanceof Error ? errorMessage(error) : String(error);
}

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

        const totalSales = (allOrders || []).reduce((acc: number, order) => acc + (parseFloat(order.total ?? '') || 0), 0);

        return {
            totalStores: Number(totalStores) || 0,
            totalUsers: Number(totalUsers) || 0,
            totalSales,
            totalProducts: Number(totalProducts) || 0,
            pendingStores: 0
        };
    } catch (error: unknown) {
        console.error('Error fetching global stats with Drizzle:', error);
        return { totalStores: 0, totalUsers: 0, totalSales: 0, totalProducts: 0, pendingStores: 0 };
    }
}

export async function getAllStores() {
    try {
        const storesList = await db.select().from(stores).orderBy(desc(stores.createdAt));
        return storesList || [];
    } catch (error: unknown) {
        console.error('Error fetching all stores with Drizzle:', error);
        return [];
    }
}

export async function getAllUsers() {
    try {
        const usersList = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
        return usersList || [];
    } catch (error: unknown) {
        console.error('Error fetching all users with Drizzle:', error);
        return [];
    }
}

export async function getGlobalProducts(limit = 100) {
    try {
        const productsList = await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
        return productsList || [];
    } catch (error: unknown) {
        console.error('Error fetching global products with Drizzle:', error);
        return [];
    }
}

export async function updateStoreApproval(storeId: string, status: string) {
    try {
        revalidatePath('/admin');
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function updateUserRole(userId: string, isSuperAdmin: boolean) {
    try {
        revalidatePath('/admin');
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function forceDeleteStore(storeId: string) {
    try {
        await db.delete(stores).where(eq(stores.id, storeId));
        revalidatePath('/admin');
        updateTag('marketplace');
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: errorMessage(error) };
    }
}

// Additional Admin exports expected by AdminView
export async function updateUserAdminStatus(userId: string, isAdmin: boolean) {
    return updateUserRole(userId, isAdmin);
}

export async function updateUserSubscription(userId: string, tier: string, duration: string) {
    try {
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
        revalidatePath('/admin');
        return { success: true };
    } catch (error: unknown) {
        return { success: false, error: errorMessage(error) };
    }
}

export async function deleteStoreAdmin(storeId: string) {
    return forceDeleteStore(storeId);
}

export async function getGlobalOrders() {
    try {
        const ordersList = await db.select().from(orders).orderBy(desc(orders.date)).limit(100);
        return ordersList || [];
    } catch (error: unknown) {
        return [];
    }
}

export async function updateStoreStatusAction(storeId: string, status: string) {
    return updateStoreApproval(storeId, status);
}

