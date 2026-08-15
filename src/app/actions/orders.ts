'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/db'
import { orders, orderItems, customers, products } from '@/db/schema'
import { eq, inArray, desc, sql, and } from 'drizzle-orm'

export async function createOrderAction(order: any, storeId: string) {
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
            const itemsToInsert = order.items.map((item: any) => ({
                orderId: orderData.id,
                productId: item.product?.id || null,
                quantity: item.quantity,
                unitPrice: (item.product?.price || 0).toString(),
                total: ((item.product?.price || 0) * item.quantity).toString(),
            }));
            
            await db.insert(orderItems).values(itemsToInsert);
        }

        if (order.customer?.id) {
            const [customer] = await db.select().from(customers).where(eq(customers.id, order.customer.id)).limit(1);
            if (customer) {
                const newSpent = parseFloat(customer.totalSpent || '0') + (order.total || 0);
                const newCount = customer.ordersCount + 1;
                await db.update(customers)
                    .set({ totalSpent: newSpent.toString(), ordersCount: newCount })
                    .where(eq(customers.id, order.customer.id));
            }
        }
        
        revalidatePath('/orders');
        revalidatePath('/pos');
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        
        return { success: true, order: orderData };
    } catch (error: any) {
        console.error('Order creation error with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
    try {
        await db.update(orders).set({ status }).where(eq(orders.id, orderId));
        revalidatePath('/orders');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating order status with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteOrderAction(id: string) {
    try {
        await db.delete(orders).where(eq(orders.id, id));
        revalidatePath('/orders');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting order with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function bulkDeleteOrdersAction(ids: string[]) {
    try {
        if (ids.length > 0) {
            await db.delete(orders).where(inArray(orders.id, ids));
        }
        revalidatePath('/orders');
        return { success: true };
    } catch (error: any) {
        console.error('Error bulk deleting orders with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function bulkUpdateOrderStatusAction(orderIds: string[], status: string) {
    try {
        if (orderIds.length > 0) {
            await db.update(orders).set({ status }).where(inArray(orders.id, orderIds));
        }
        revalidatePath('/orders');
        return { success: true };
    } catch (error: any) {
        console.error('Error bulk updating order status with Drizzle:', error);
        return { success: false, error: error.message };
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

        const orderIds = (ordersList || []).map((o: any) => o.id);
        let customersMap: Record<string, any> = {};
        if (orderIds.length > 0) {
            const customerIds = [...new Set((ordersList || []).map((o: any) => o.customerId).filter(Boolean))];
            if (customerIds.length > 0) {
                const customerRows = await db.select().from(customers).where(inArray(customers.id, customerIds));
                customersMap = Object.fromEntries(customerRows.map((c: any) => [c.id, c]));
            }
        }

        return { 
            success: true, 
            orders: (ordersList || []).map((o: any) => {
                const customer = o.customerId ? customersMap[o.customerId] : undefined;
                return {
                    ...o,
                    total: parseFloat(o.total) || 0,
                    subtotal: parseFloat(o.subtotal) || 0,
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
    } catch (error: any) {
        console.error('Error getting orders with Drizzle:', error);
        return { success: false, orders: [], hasMore: false, total: 0, error: error.message };
    }
}
