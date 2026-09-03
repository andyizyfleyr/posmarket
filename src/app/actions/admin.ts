'use server';

import { db } from '@/db';
import { stores, profiles, orders, products, productReviews, orderItems, invoices, systemSettings } from '@/db/schema';
import { eq, desc, sql, inArray } from 'drizzle-orm';
import { revalidatePath, updateTag } from 'next/cache';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function getGlobalStats() {
  try {
    const [
      [{ count: totalStores }],
      [{ count: totalUsers }],
      allOrders,
      [{ count: totalProducts }],
      [{ count: pendingStores }],
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(stores),
      db.select({ count: sql<number>`count(*)` }).from(profiles),
      db.select({ total: orders.total }).from(orders),
      db.select({ count: sql<number>`count(*)` }).from(products),
      db.select({ count: sql<number>`count(*)` }).from(stores).where(eq(stores.status, 'PENDING')),
    ]);

    const totalSales = (allOrders || []).reduce((acc: number, order) => acc + (parseFloat(order.total ?? '') || 0), 0);

    return {
      totalStores: Number(totalStores) || 0,
      totalUsers: Number(totalUsers) || 0,
      totalSales,
      totalProducts: Number(totalProducts) || 0,
      pendingStores: Number(pendingStores) || 0
    };
  } catch (error: unknown) {
    console.error('Error fetching global stats:', error);
    return { totalStores: 0, totalUsers: 0, totalSales: 0, totalProducts: 0, pendingStores: 0 };
  }
}

export async function getAllStores() {
  try {
    const storesList = await db.select().from(stores).orderBy(desc(stores.createdAt));
    return storesList || [];
  } catch (error: unknown) {
    console.error('Error fetching all stores:', error);
    return [];
  }
}

export async function getAllUsers() {
  try {
    const usersList = await db.select().from(profiles).orderBy(desc(profiles.createdAt));
    return usersList || [];
  } catch (error: unknown) {
    console.error('Error fetching all users:', error);
    return [];
  }
}

export async function getGlobalProducts(limit = 100) {
  try {
    const productsList = await db.select().from(products).orderBy(desc(products.createdAt)).limit(limit);
    return productsList || [];
  } catch (error: unknown) {
    console.error('Error fetching global products:', error);
    return [];
  }
}

export async function getGlobalOrders(limit = 100) {
  try {
    const ordersList = await db.select().from(orders).orderBy(desc(orders.date)).limit(limit);
    return ordersList || [];
  } catch (error: unknown) {
    console.error('Error fetching global orders:', error);
    return [];
  }
}

export async function getGlobalReviews(limit = 100) {
  try {
    const reviewsList = await db.select().from(productReviews).orderBy(desc(productReviews.createdAt)).limit(limit);
    return reviewsList || [];
  } catch (error: unknown) {
    console.error('Error fetching global reviews:', error);
    return [];
  }
}

export async function getGlobalInvoices(limit = 100) {
  try {
    const invoicesList = await db.select().from(invoices).orderBy(desc(invoices.createdAt)).limit(limit);
    return invoicesList || [];
  } catch (error: unknown) {
    console.error('Error fetching global invoices:', error);
    return [];
  }
}

export async function getOrderItems(orderId: string) {
  try {
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    return items || [];
  } catch (error: unknown) {
    console.error('Error fetching order items:', error);
    return [];
  }
}

export async function getStoreById(storeId: string) {
  try {
    const [store] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    return store || null;
  } catch (error: unknown) {
    console.error('Error fetching store:', error);
    return null;
  }
}

export async function getUserById(userId: string) {
  try {
    const [user] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
    return user || null;
  } catch (error: unknown) {
    console.error('Error fetching user:', error);
    return null;
  }
}

export async function getUserStores(userId: string) {
  try {
    const userStores = await db.select().from(stores).where(eq(stores.userId, userId)).orderBy(desc(stores.createdAt));
    return userStores || [];
  } catch (error: unknown) {
    console.error('Error fetching user stores:', error);
    return [];
  }
}

export async function getStoreOrders(storeId: string) {
  try {
    const storeOrders = await db.select().from(orders).where(eq(orders.storeId, storeId)).orderBy(desc(orders.date));
    return storeOrders || [];
  } catch (error: unknown) {
    console.error('Error fetching store orders:', error);
    return [];
  }
}

export async function getStoreProducts(storeId: string) {
  try {
    const storeProducts = await db.select().from(products).where(eq(products.storeId, storeId)).orderBy(desc(products.createdAt));
    return storeProducts || [];
  } catch (error: unknown) {
    console.error('Error fetching store products:', error);
    return [];
  }
}

export async function getAllStoreProductCounts(): Promise<Record<string, number>> {
  try {
    const rows = await db
      .select({ storeId: products.storeId, count: sql<number>`count(*)` })
      .from(products)
      .groupBy(products.storeId);
    const map: Record<string, number> = {};
    (rows || []).forEach(r => {
      if (r.storeId) map[r.storeId] = Number(r.count) || 0;
    });
    return map;
  } catch (error: unknown) {
    console.error('Error fetching store product counts:', error);
    return {};
  }
}

export async function getStoreReviews(storeId: string) {
  try {
    const storeReviews = await db.select().from(productReviews).where(eq(productReviews.storeId, storeId)).orderBy(desc(productReviews.createdAt));
    return storeReviews || [];
  } catch (error: unknown) {
    console.error('Error fetching store reviews:', error);
    return [];
  }
}

export async function updateStoreApproval(storeId: string, status: string) {
  try {
    await db.update(stores).set({ status }).where(eq(stores.id, storeId));
    revalidatePath('/pam/stores');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function updateUserRole(userId: string, isSuperAdmin: boolean) {
  try {
    await db.update(profiles).set({ isSuperAdmin }).where(eq(profiles.id, userId));
    revalidatePath('/pam/users');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

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
    revalidatePath('/pam/users');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteUser(userId: string) {
  try {
    await db.delete(profiles).where(eq(profiles.id, userId));
    revalidatePath('/pam/users');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function forceDeleteStore(storeId: string) {
  try {
    await db.delete(stores).where(eq(stores.id, storeId));
    revalidatePath('/pam/stores');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteStoreAdmin(storeId: string) {
  return forceDeleteStore(storeId);
}

export async function deleteUsersBulk(userIds: string[]) {
  if (!userIds.length) return { success: true, deleted: 0 };
  try {
    await db.delete(profiles).where(inArray(profiles.id, userIds));
    revalidatePath('/pam/users');
    updateTag('marketplace');
    return { success: true, deleted: userIds.length };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteStoresBulk(storeIds: string[]) {
  if (!storeIds.length) return { success: true, deleted: 0 };
  try {
    await db.delete(stores).where(inArray(stores.id, storeIds));
    revalidatePath('/pam/stores');
    updateTag('marketplace');
    return { success: true, deleted: storeIds.length };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteReview(reviewId: string) {
  try {
    await db.delete(productReviews).where(eq(productReviews.id, reviewId));
    revalidatePath('/pam/reviews');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function deleteProduct(productId: string) {
  try {
    await db.delete(products).where(eq(products.id, productId));
    revalidatePath('/pam/inventory');
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}

export async function updateStoreStatusAction(storeId: string, status: string) {
  return updateStoreApproval(storeId, status);
}

export interface SystemSettingsData {
  maintenance: boolean;
  auto_indexing: boolean;
  weekly_reports: boolean;
}

export async function getSystemSettings(): Promise<{ success: boolean; error?: string; settings: SystemSettingsData }> {
  try {
    const rows = await db.select().from(systemSettings);
    const settings: SystemSettingsData = { maintenance: false, auto_indexing: true, weekly_reports: true };
    rows.forEach(r => {
      if (r.key === 'maintenance' || r.key === 'auto_indexing' || r.key === 'weekly_reports') {
        settings[r.key] = r.value === 'true';
      }
    });
    return { success: true, settings };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error), settings: { maintenance: false, auto_indexing: true, weekly_reports: true } };
  }
}

export async function updateSystemSettings(settings: { maintenance: boolean; auto_indexing: boolean; weekly_reports: boolean }) {
  try {
    for (const [key, value] of Object.entries(settings)) {
      await db.insert(systemSettings)
        .values({ key, value: String(value) })
        .onConflictDoUpdate({ target: systemSettings.key, set: { value: String(value), updatedAt: new Date() } });
    }
    revalidatePath('/pam/settings');
    return { success: true };
  } catch (error: unknown) {
    return { success: false, error: errorMessage(error) };
  }
}
