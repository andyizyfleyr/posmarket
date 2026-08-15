'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { customers } from '@/db/schema'
import { eq, or, and, sql, inArray, desc } from 'drizzle-orm'

export async function saveCustomerAction(customer: any, storeId: string) {
    try {
        const dataToSave = {
            storeId,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            totalSpent: (customer.totalSpent !== undefined ? customer.totalSpent : customer.total_spent)?.toString() || '0',
            ordersCount: customer.ordersCount !== undefined ? customer.ordersCount : customer.orders_count || 0,
        };

        let savedCustomer;
        if (customer.id && !customer.id.startsWith('temp-')) {
            [savedCustomer] = await db
                .update(customers)
                .set(dataToSave)
                .where(eq(customers.id, customer.id))
                .returning();
        } else {
            [savedCustomer] = await db
                .insert(customers)
                .values(dataToSave)
                .returning();
        }

        revalidatePath('/customers');
        return { success: true, customer: savedCustomer };
    } catch (error: any) {
        console.error('Error saving customer with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteCustomerAction(id: string) {
    try {
        await db.delete(customers).where(eq(customers.id, id));
        revalidatePath('/customers');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting customer with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function bulkDeleteCustomersAction(ids: string[]) {
    try {
        if (ids.length > 0) {
            await db.delete(customers).where(inArray(customers.id, ids));
        }
        revalidatePath('/customers');
        return { success: true };
    } catch (error: any) {
        console.error('Error bulk deleting customers with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function getCustomersAction(storeId: string, offset: number = 0, limit: number = 10, search: string = '') {
    try {
        let conditions = [eq(customers.storeId, storeId)];

        if (search) {
            conditions.push(or(
                sql`${customers.name} ILIKE ${`%${search}%`}`,
                sql`${customers.phone} ILIKE ${`%${search}%`}`
            )!);
        }

        const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

        const [customersList, [{ count: totalCount }]] = await Promise.all([
            db.select()
                .from(customers)
                .where(whereClause)
                .orderBy(desc(customers.totalSpent))
                .limit(limit)
                .offset(offset),
            db.select({ count: sql<number>`count(*)` })
                .from(customers)
                .where(whereClause)
        ]);

        const total = Number(totalCount) || 0;

        return { 
            success: true, 
            customers: (customersList || []).map((c: any) => ({
                ...c,
                totalSpent: parseFloat(c.totalSpent) || 0,
                ordersCount: Number(c.ordersCount) || 0,
            })), 
            hasMore: total > (offset + customersList.length),
            total
        };
    } catch (error: any) {
        console.error('Error fetching customers with Drizzle:', error);
        return { success: false, error: error.message, customers: [], total: 0 };
    }
}
