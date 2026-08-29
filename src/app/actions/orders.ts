'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { db } from '@/db'
import { orders, orderItems, customers, products } from '@/db/schema'
import { invalidateOrdersCache, getStoreIdForOrder } from '@/db/api'
import { eq, inArray, desc, sql, and } from 'drizzle-orm'

type OrderItemInput = {
  product?: { id?: string; price?: number | string } | null;
  quantity?: number;
}

type OrderInput = {
  customer?: { id?: string } | null;
  date?: string | Date;
  status?: string;
  paymentMethod?: string;
  subtotal?: number | string;
  total?: number | string;
  discountAmount?: number | string;
  items?: OrderItemInput[];
}

export async function createOrderAction(order: OrderInput, storeId: string) {
    try {
        const dbOrder = {
            storeId,
            customerId: order.customer?.id || null,
            date: order.date ? new Date(order.date) : new Date(),
            status: order.status || 'COMPLETED',
            paymentMethod: order.paymentMethod || 'ESPECES',
            subtotal: order.subtotal?.toString() || '0',
            total: order.total?.toString() || '0',
            discountAmount: (order.discountAmount || 0).toString(),
        };
        
        const [orderData] = await db.insert(orders).values(dbOrder).returning();
        
        if (order.items && order.items.length > 0) {
            const itemsToInsert = order.items.map((item) => ({
                orderId: orderData.id,
                productId: item.product?.id || null,
                quantity: item.quantity ?? 1,
                unitPrice: String(item.product?.price ?? 0),
                total: String(Number(item.product?.price ?? 0) * (item.quantity ?? 1)),
            }));
            
            await db.insert(orderItems).values(itemsToInsert);
        }

        if (order.customer?.id) {
            const [customer] = await db.select().from(customers).where(eq(customers.id, order.customer.id)).limit(1);
            if (customer) {
                const newSpent = parseFloat(customer.totalSpent || '0') + Number(order.total || 0);
                const newCount = customer.ordersCount + 1;
                await db.update(customers)
                    .set({ totalSpent: newSpent.toString(), ordersCount: newCount })
                    .where(eq(customers.id, order.customer.id));
            }
        }
        
        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, undefined as never);
        revalidatePath('/orders');
        revalidatePath('/pos');
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        
        return { success: true, order: orderData };
    } catch (error: unknown) {
        console.error('Order creation error with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
    try {
        const storeId = await getStoreIdForOrder(orderId);
        await db.update(orders).set({ status }).where(eq(orders.id, orderId));
        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, undefined as never);
        revalidatePath('/orders');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error updating order status with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteOrderAction(id: string) {
    try {
        const storeId = await getStoreIdForOrder(id);
        await db.delete(orders).where(eq(orders.id, id));
        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, undefined as never);
        revalidatePath('/orders');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error deleting order with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function bulkDeleteOrdersAction(ids: string[]) {
    try {
        if (ids.length > 0) {
            const storeIds = new Set<string>();
            for (const id of ids) {
                const sid = await getStoreIdForOrder(id);
                if (sid) storeIds.add(sid);
            }
            await db.delete(orders).where(inArray(orders.id, ids));
            storeIds.forEach(sid => {
                invalidateOrdersCache(sid);
                revalidateTag(`orders:${sid}`, undefined as never);
            });
        }
        revalidatePath('/orders');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error bulk deleting orders with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function bulkUpdateOrderStatusAction(orderIds: string[], status: string) {
    try {
        if (orderIds.length > 0) {
            const storeIds = new Set<string>();
            for (const id of orderIds) {
                const sid = await getStoreIdForOrder(id);
                if (sid) storeIds.add(sid);
            }
            await db.update(orders).set({ status }).where(inArray(orders.id, orderIds));
            storeIds.forEach(sid => {
                invalidateOrdersCache(sid);
                revalidateTag(`orders:${sid}`, undefined as never);
            });
        }
        revalidatePath('/orders');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error bulk updating order status with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function getOrdersAction(
    storeId: string, 
    offset: number = 0, 
    limit: number = 10, 
    search: string = '', 
    filterStatus: string = 'all'
) {
    try {
        const conditions = [eq(orders.storeId, storeId)];
        const statusFilter = String(filterStatus || '').toUpperCase();

        if (statusFilter && statusFilter !== 'ALL') {
            conditions.push(eq(orders.status, statusFilter));
        }

        const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

        const [ordersList, [{ count: totalCount }]] = await Promise.all([
            db.select()
                .from(orders)
                .where(whereClause)
                .orderBy(desc(orders.date))
                .limit(limit)
                .offset(offset),
            db.select({ count: sql<number>`count(*)` })
                .from(orders)
                .where(whereClause)
        ]);

        const total = Number(totalCount) || 0;

        const orderIds = (ordersList || []).map((o) => o.id);
        let customersMap: Record<string, (typeof customers.$inferSelect)> = {};
        if (orderIds.length > 0) {
            const customerIds = [...new Set((ordersList || []).map((o) => o.customerId).filter((x): x is string => Boolean(x)))];
            if (customerIds.length > 0) {
                const customerRows = await db.select().from(customers).where(inArray(customers.id, customerIds));
                customersMap = Object.fromEntries(customerRows.map((c) => [c.id, c]));
            }
        }

        return { 
            success: true, 
            orders: (ordersList || []).map((o) => {
                const customer = o.customerId ? customersMap[o.customerId] : undefined;
                return {
                    ...o,
                    total: parseFloat(o.total ?? '') || 0,
                    subtotal: parseFloat(o.subtotal ?? '') || 0,
                    discountAmount: o.discountAmount ? parseFloat(o.discountAmount) : 0,
                    customer: customer
                        ? {
                            id: customer.id,
                            name: customer.name,
                            email: customer.email || '',
                            phone: customer.phone || '',
                            address: customer.address || '',
                        }
                        : undefined,
                };
            }),
            hasMore: total > (offset + ordersList.length),
            total
        };
    } catch (error: unknown) {
        console.error('Error getting orders with Drizzle:', error);
        return { success: false, orders: [], hasMore: false, total: 0, error: error instanceof Error ? error.message : String(error) };
    }
}
