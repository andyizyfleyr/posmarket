'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { db } from '@/db'
import { orders, orderItems, customers } from '@/db/schema'
import { invalidateOrdersCache, getStoreIdForOrder, incrementProductSales } from '@/db/api'
import { eq, inArray, desc, sql, and } from 'drizzle-orm'
import { notify, getStorePhone, getProfilePhone, getProfileEmail } from '@/lib/notifications'
import { isWhatsAppConfigured } from '@/lib/whatsapp'
import { isEmailConfigured, orderEmailProducts } from '@/lib/email'

// ---------------------------------------------------------------------------
// WhatsApp notification helpers (best-effort, never blocks the action)
// ---------------------------------------------------------------------------

async function sendOrderNotifications(orderData: { id: string; storeId: string; total?: string | number; paymentMethod?: string }) {
    if (!isWhatsAppConfigured() && !(await isEmailConfigured())) return;
    try {
        const storeInfo = await getStorePhone(orderData.storeId);
        const shortId = orderData.id.slice(0, 8).toUpperCase();
        const totalStr = new Intl.NumberFormat('fr-FR').format(Number(orderData.total) || 0);
        const paymentLabel = orderData.paymentMethod === 'CARTE' ? 'Carte' : 'Espèces';
        const products = await orderEmailProducts(orderData.id);
        await notify({
            userId: storeInfo?.ownerId || null,
            phone: storeInfo?.phone || '',
            email: storeInfo?.email || '',
            eventType: 'VENTE_POS',
            title: 'Vente en boutique',
            body: `Vente POS #${shortId} — ${totalStr} FCFA — ${paymentLabel}`,
            templateParams: [shortId, totalStr],
            emailData: { order: shortId, total: totalStr, store: storeInfo?.name || '', storeSlug: storeInfo?.slug || '', payment: orderData.paymentMethod || '', paymentLabel, items: products.length || undefined, products },
        });
    } catch {}
}

async function sendStatusNotifications(orderId: string, status: string) {
    if (!isWhatsAppConfigured() && !(await isEmailConfigured())) return;
    try {
        const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
        if (!order) return;

        const shortId = orderId.slice(0, 8).toUpperCase();
        let storeInfo: { name: string; slug: string; phone: string; email: string; ownerId: string | null } | null = null;
        if (order.storeId) storeInfo = await getStorePhone(order.storeId);

        let buyerPhone = '';
        if (order.buyerUserId) {
            buyerPhone = await getProfilePhone(order.buyerUserId);
        }
        if (!buyerPhone && order.customerId) {
            const [cust] = await db.select({ phone: customers.phone }).from(customers).where(eq(customers.id, order.customerId)).limit(1);
            buyerPhone = cust?.phone || '';
        }
        let buyerEmail = order.buyerEmail || '';
        if (!buyerEmail && order.buyerUserId) {
            buyerEmail = await getProfileEmail(order.buyerUserId);
        }
        if (!buyerEmail && order.customerId) {
            const [cust] = await db.select({ email: customers.email }).from(customers).where(eq(customers.id, order.customerId)).limit(1);
            buyerEmail = cust?.email || '';
        }
        if (!buyerPhone && !buyerEmail) return;

        const eventName =
            status === 'READY'
                ? 'COMMANDE_PRET'
                : status === 'COMPLETED'
                    ? 'COMMANDE_LIVREE'
                    : status === 'CANCELLED' || status === 'ANNULEE'
                        ? 'COMMANDE_ANNULEE'
                        : null;
        if (!eventName) return;

        const products = await orderEmailProducts(orderId);
        const labels = { COMMANDE_PRET: 'Commande prête', COMMANDE_LIVREE: 'Commande livrée', COMMANDE_ANNULEE: 'Commande annulée' };
        const storeLabel = storeInfo?.name || 'boutique';
        const totalStr = new Intl.NumberFormat('fr-FR').format(Number(order.total) || 0);
        const bodies = {
            COMMANDE_PRET: `Votre commande #${shortId} (${storeLabel}) est prête pour la récupération.`,
            COMMANDE_LIVREE: `Votre commande #${shortId} (${storeLabel}) a bien été livrée. Merci pour votre achat !`,
            COMMANDE_ANNULEE: `Votre commande #${shortId} (${storeLabel}) a été annulée. Contactez la boutique pour plus d'informations.`,
        };

        await notify({
            userId: order.buyerUserId || null,
            phone: buyerPhone,
            email: buyerEmail,
            eventType: eventName,
            title: labels[eventName as keyof typeof labels],
            body: bodies[eventName as keyof typeof bodies],
            templateParams: [shortId, storeInfo?.name || 'boutique'],
            emailData: { order: shortId, store: storeLabel, storeSlug: storeInfo?.slug || '', total: totalStr, products },
        });

        if (eventName === 'COMMANDE_LIVREE') {
            await notify({
                userId: order.buyerUserId || null,
                email: buyerEmail,
                eventType: 'DEMANDE_AVIS',
                title: 'Donnez votre avis',
                body: `Votre commande #${shortId} (${storeLabel}) vous a été livrée. Partagez votre expérience en laissant un avis.`,
                templateParams: [shortId, storeInfo?.name || 'boutique'],
                emailData: { order: shortId, store: storeLabel, storeSlug: storeInfo?.slug || '', products },
                scheduledAt: new Date(Date.now() + 15 * 60 * 1000),
            });
        }
    } catch {}
}

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
            await incrementProductSales(
              storeId,
              order.items.map((item) => ({
                productId: item.product?.id ?? null,
                quantity: item.quantity ?? 1,
              }))
            );
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

        sendOrderNotifications(orderData).catch(() => {});
        
        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, 'max');
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
        sendStatusNotifications(orderId, status).catch(() => {});
        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, 'max');
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
        if (storeId) revalidateTag(`orders:${storeId}`, 'max');
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
                revalidateTag(`orders:${sid}`, 'max');
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
                revalidateTag(`orders:${sid}`, 'max');
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
