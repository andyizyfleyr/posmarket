'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { refreshTag } from '@/lib/revalidate'
import { db } from '@/db'
import { orders, orderItems, customers } from '@/db/schema'
import { invalidateOrdersCache, getStoreIdForOrder, incrementProductSales, decrementProductSales, adjustProductStock, isCancelledOrderStatus, getOrderItemsForStock } from '@/db/api'
import { eq, inArray, desc, sql, and, or, ilike } from 'drizzle-orm'
import { notify, getStorePhone, getProfilePhone, getProfileEmail } from '@/lib/notifications'
import { sendPushToGuest } from '@/lib/push'
import { buildPushContent } from '@/lib/push-templates'
import { orderEmailProducts } from '@/lib/email'
import { requireStoreAccess } from '@/lib/authorization'
import { markOfflineStorePaymentCollected } from '@/lib/store-payments'

// ---------------------------------------------------------------------------
// Garde-fous d'accès
//
// Sans ces vérifications, ces actions sont des endpoints HTTP publics : il
// suffit de connaître un identifiant de commande pour la supprimer, ou celui
// d'une boutique pour lire toutes ses commandes.
// ---------------------------------------------------------------------------

/** Vérifie que l'appelant peut gérer la boutique à laquelle appartient la commande. */
async function requireOrderAccess(orderId: string): Promise<{ ok: true; storeId: string | null } | { ok: false; error: string }> {
    const storeId = await getStoreIdForOrder(orderId)
    if (!storeId) return { ok: false, error: 'Commande introuvable' }
    const access = await requireStoreAccess(storeId)
    if (!access.ok) return { ok: false, error: access.error }
    return { ok: true, storeId }
}

/** Variante « toutes les commandes doivent être accessibles » pour les actions groupées. */
async function requireAllOrdersAccess(orderIds: string[]): Promise<{ ok: true; storeIds: string[] } | { ok: false; error: string }> {
    const storeIds = new Set<string>()
    for (const id of orderIds) {
        const check = await requireOrderAccess(id)
        if (!check.ok) return { ok: false, error: check.error }
        if (check.storeId) storeIds.add(check.storeId)
    }
    return { ok: true, storeIds: Array.from(storeIds) }
}

// ---------------------------------------------------------------------------
// WhatsApp notification helpers (best-effort, never blocks the action)
// ---------------------------------------------------------------------------

async function sendStatusNotifications(orderId: string, status: string) {
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
        if (!buyerPhone && !buyerEmail && !order.buyerUserId) return;

        const eventName =
            status === 'COMPLETED'
                ? 'COMMANDE_LIVREE'
                : status === 'CANCELLED' || status === 'ANNULEE'
                    ? 'COMMANDE_ANNULEE'
                    : status === 'READY'
                        ? 'COMMANDE_PRET'
                        : null;
        if (!eventName) return;

        const products = await orderEmailProducts(orderId);
        const labels = {
            COMMANDE_PRET: 'Commande prête',
            COMMANDE_LIVREE: 'Commande livrée',
            COMMANDE_ANNULEE: 'Commande annulée',
        };
        const storeLabel = storeInfo?.name || 'boutique';
        const totalStr = new Intl.NumberFormat('fr-FR').format(Number(order.total) || 0);
        const bodies = {
            COMMANDE_PRET: `Votre commande ${shortId} (${storeLabel}) est prête. Présentez votre référence lors du retrait.`,
            COMMANDE_LIVREE: `Votre commande ${shortId} (${storeLabel}) a bien été livrée. Merci pour votre achat.`,
            COMMANDE_ANNULEE: `Votre commande ${shortId} (${storeLabel}) a été annulée. Contactez la boutique pour plus d'informations.`,
        };

        await notify({
            userId: order.buyerUserId || null,
            phone: buyerPhone,
            email: buyerEmail,
            eventType: eventName,
            title: labels[eventName as keyof typeof labels],
            body: bodies[eventName as keyof typeof bodies],
            templateParams: [shortId, storeInfo?.name || 'boutique'],
            emailData: { order: shortId, orderId: order.id, store: storeLabel, storeSlug: storeInfo?.slug || '', total: totalStr, products },
        });

        // Invité sans compte : envoyer le push directement aux appareils liés à cette commande
        if (!order.buyerUserId) {
            try {
                const pushContent = buildPushContent(eventName, {
                    title: labels[eventName as keyof typeof labels],
                    body: bodies[eventName as keyof typeof bodies],
                    emailData: { order: shortId, orderId: order.id, store: storeLabel, storeSlug: storeInfo?.slug || '', total: totalStr },
                });
                await sendPushToGuest(order.id, {
                    title: pushContent.title,
                    body: pushContent.body,
                    url: `/account?tab=orders&order=${order.id}`,
                    channelId: pushContent.channelId,
                });
            } catch {}
        }

        if (eventName === 'COMMANDE_LIVREE') {
            await notify({
                userId: order.buyerUserId || null,
                email: buyerEmail,
                eventType: 'DEMANDE_AVIS',
                title: 'Donnez votre avis',
                body: `Votre commande ${shortId} (${storeLabel}) vous a été livrée. Partagez votre expérience en laissant un avis.`,
                templateParams: [shortId, storeInfo?.name || 'boutique'],
                emailData: { order: shortId, orderId: order.id, store: storeLabel, storeSlug: storeInfo?.slug || '', products },
                scheduledAt: new Date(Date.now() + 15 * 60 * 1000),
                marker: `order-${shortId}`,
            });

            if (!order.buyerUserId) {
                try {
                    const pushContent = buildPushContent('DEMANDE_AVIS', {
                        title: 'Donnez votre avis',
                        body: `Votre commande ${shortId} (${storeLabel}) vous a été livrée. Partagez votre expérience en laissant un avis.`,
                        emailData: { order: shortId, orderId: order.id, store: storeLabel, storeSlug: storeInfo?.slug || '' },
                    });
                    await sendPushToGuest(order.id, {
                        title: pushContent.title,
                        body: pushContent.body,
                        url: pushContent.url,
                        channelId: pushContent.channelId,
                    });
                } catch {}
            }
        }
    } catch {}
}

type OrderItemInput = {
  product?: { id?: string; price?: number | string } | null;
  quantity?: number;
  variantId?: string | null;
  variantLabel?: string | null;
  variantSku?: string | null;
  variantOptionValues?: Record<string, string> | null;
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
        const access = await requireStoreAccess(storeId);
        if (!access.ok) return { success: false, error: access.error };

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
                // Instantané de la variante : l'annulation doit pouvoir
                // réintégrer le bon stock sans rouvrir la fiche produit.
                variantId: item.variantId ?? null,
                variantLabel: item.variantLabel ?? null,
                variantSku: item.variantSku ?? null,
                variantOptionValues: item.variantOptionValues ?? {},
            }));
            
            await db.insert(orderItems).values(itemsToInsert);
            await incrementProductSales(
              storeId,
              order.items.map((item) => ({
                productId: item.product?.id ?? null,
                quantity: item.quantity ?? 1,
              }))
            );
            await adjustProductStock(
              storeId,
              order.items.map((item) => ({
                productId: item.product?.id ?? null,
                quantity: item.quantity ?? 1,
                variantId: item.variantId ?? null,
              })),
              'sale'
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

        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, 'max');
        revalidatePath('/orders');
        revalidatePath('/pos');
        revalidatePath('/inventory');
        revalidatePath('/dashboard');
        refreshTag('marketplace');
        refreshTag(`products:${storeId}`);
        refreshTag(`customers:${storeId}`);

        try {
          const storeInfo = await getStorePhone(storeId);
          if (storeInfo?.ownerId) {
            const totalStr = new Intl.NumberFormat('fr-FR').format(Number(orderData.total) || 0);
            const itemCount = (order.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
            await notify({
              userId: storeInfo.ownerId,
              phone: storeInfo.phone,
              email: storeInfo.email || '',
              eventType: 'VENTE_POS',
              title: 'Vente enregistrée',
              body: `Vente ${orderData.status === 'COMPLETED' ? 'terminée' : orderData.status} : ${itemCount} article(s) pour ${totalStr} FCFA.`,
              templateParams: [String(itemCount), totalStr],
              emailData: { total: totalStr, items: itemCount, store: storeInfo?.name || '', storeSlug: storeInfo?.slug || '' },
            });
          }
        } catch {}

        return { success: true, order: orderData };
    } catch (error: unknown) {
        console.error('Order creation error with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
    try {
        const access = await requireOrderAccess(orderId);
        if (!access.ok) return { success: false, error: access.error };
        const storeId = access.storeId;
        const [existing] = await db.select({ status: orders.status, boosted: orders.boosted }).from(orders).where(eq(orders.id, orderId)).limit(1);
        await db.update(orders).set({ status }).where(eq(orders.id, orderId));

        // Commande terminée = COD / USSD encaissés en main propre : le serveur
        // marque le paiement off-line collecté. Les paiements en ligne restent
        // soumis à la vérification fournisseur.
        if (String(status || '').toUpperCase() === 'COMPLETED') {
            await markOfflineStorePaymentCollected(orderId).catch((err) =>
                console.error('[orders] encaissement hors ligne:', err),
            );
        }

        // Une commande annulée (pas déjà annulée) redonne son stock — sauf si
        // elle est boostée : celle-ci n'a jamais décrémenté ce stock, la
        // réintégrer ferait monter l'inventaire au-dessus du niveau réel.
        // `total_sales`, lui, a bien été compté (commande réelle ou boostée) :
        // il faut donc le décrémenter dans les deux cas.
        if (existing && !isCancelledOrderStatus(existing.status) && isCancelledOrderStatus(status) && storeId) {
            const items = await getOrderItemsForStock(orderId);
            if (!existing.boosted) await adjustProductStock(storeId, items, 'restore');
            await decrementProductSales(storeId, items);
            refreshTag('marketplace');
            refreshTag(`products:${storeId}`);
        }

        sendStatusNotifications(orderId, status).catch(() => {});
        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, 'max');
        revalidatePath('/orders');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error updating order status with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteOrderAction(id: string) {
    try {
        const access = await requireOrderAccess(id);
        if (!access.ok) return { success: false, error: access.error };
        const storeId = access.storeId;
        const [existing] = await db.select({ status: orders.status, boosted: orders.boosted }).from(orders).where(eq(orders.id, id)).limit(1);
        // Voir `updateOrderStatusAction` : une commande boostée n'a jamais
        // décrémenté le stock, on ne réintègre donc rien à sa suppression —
        // mais ses ventes comptées, elles, doivent être retirées.
        if (storeId && existing && !isCancelledOrderStatus(existing.status)) {
            const items = await getOrderItemsForStock(id);
            if (!existing.boosted) await adjustProductStock(storeId, items, 'restore');
            await decrementProductSales(storeId, items);
            refreshTag('marketplace');
            refreshTag(`products:${storeId}`);
        }
        await db.delete(orders).where(eq(orders.id, id));
        invalidateOrdersCache(storeId);
        if (storeId) revalidateTag(`orders:${storeId}`, 'max');
        revalidatePath('/orders');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error deleting order with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function bulkDeleteOrdersAction(ids: string[]) {
    try {
        if (ids.length > 0) {
            const bulkAccess = await requireAllOrdersAccess(ids);
            if (!bulkAccess.ok) return { success: false, error: bulkAccess.error };
            const storeIds = new Set<string>();
            for (const id of ids) {
                const sid = await getStoreIdForOrder(id);
                if (sid) storeIds.add(sid);
                const [existing] = await db.select({ status: orders.status, boosted: orders.boosted }).from(orders).where(eq(orders.id, id)).limit(1);
                if (sid && existing && !isCancelledOrderStatus(existing.status)) {
                    const items = await getOrderItemsForStock(id);
                    if (!existing.boosted) await adjustProductStock(sid, items, 'restore');
                    await decrementProductSales(sid, items);
                    refreshTag('marketplace');
            refreshTag(`products:${sid}`);
                }
            }
            await db.delete(orders).where(inArray(orders.id, ids));
            storeIds.forEach(sid => {
                invalidateOrdersCache(sid);
                revalidateTag(`orders:${sid}`, 'max');
            });
        }
        revalidatePath('/orders');
        revalidatePath('/inventory');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error bulk deleting orders with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function bulkUpdateOrderStatusAction(orderIds: string[], status: string) {
    try {
        if (orderIds.length > 0) {
            const bulkAccess = await requireAllOrdersAccess(orderIds);
            if (!bulkAccess.ok) return { success: false, error: bulkAccess.error };
            const storeIds = new Set<string>();
            for (const id of orderIds) {
                const sid = await getStoreIdForOrder(id);
                if (sid) storeIds.add(sid);
                // Cohérent avec `updateOrderStatusAction` : une transition vers
                // un statut annulé réintègre le stock (sauf commande boostée)
                // et retire les ventes comptées.
                if (!sid || !isCancelledOrderStatus(status)) continue;
                const [existing] = await db.select({ status: orders.status, boosted: orders.boosted }).from(orders).where(eq(orders.id, id)).limit(1);
                if (!existing || isCancelledOrderStatus(existing.status)) continue;
                const items = await getOrderItemsForStock(id);
                if (!existing.boosted) await adjustProductStock(sid, items, 'restore');
                await decrementProductSales(sid, items);
                refreshTag('marketplace');
            refreshTag(`products:${sid}`);
            }
            await db.update(orders).set({ status }).where(inArray(orders.id, orderIds));
            if (String(status || '').toUpperCase() === 'COMPLETED') {
                await Promise.allSettled(
                    orderIds.map((id) => markOfflineStorePaymentCollected(String(id))),
                );
            }
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

const fetchCachedOrders = (
    storeId: string,
    offset: number,
    limit: number,
    search: string,
    filterStatus: string
) =>
    unstable_cache(
        async () => {
            const conditions = [eq(orders.storeId, storeId)];
            const statusFilter = String(filterStatus || '').toUpperCase();

            if (statusFilter && statusFilter !== 'ALL') {
                conditions.push(eq(orders.status, statusFilter));
            }

            const term = String(search || '').trim();
            const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

            const searchClause = term
                ? or(
                    ilike(orders.id, `%${term}%`),
                    ilike(orders.promoCode, `%${term}%`),
                    ilike(customers.name, `%${term}%`),
                    ilike(customers.phone, `%${term}%`)
                )
                : undefined;

            const query = searchClause ? and(whereClause, searchClause) : whereClause;

            const [ordersList, [{ count: totalCount }]] = await Promise.all([
                db.select({
                    order: orders,
                    customerName: customers.name,
                    customerEmail: customers.email,
                    customerPhone: customers.phone,
                    customerAddress: customers.address,
                })
                    .from(orders)
                    .leftJoin(customers, eq(orders.customerId, customers.id))
                    .where(query)
                    .orderBy(desc(orders.date))
                    .limit(limit)
                    .offset(offset),
                db.select({ count: sql<number>`count(*)` })
                    .from(orders)
                    .leftJoin(customers, eq(orders.customerId, customers.id))
                    .where(query)
            ]);

            const total = Number(totalCount) || 0;
            return {
                orders: (ordersList || []).map(({ order: o, customerName, customerEmail, customerPhone, customerAddress }) => ({
                    ...o,
                    date: o.date ? new Date(o.date).toISOString() : new Date().toISOString(),
                    total: parseFloat(o.total ?? '') || 0,
                    subtotal: parseFloat(o.subtotal ?? '') || 0,
                    discountAmount: o.discountAmount ? parseFloat(o.discountAmount) : 0,
                    customer: o.customerId
                        ? {
                            id: o.customerId,
                            name: customerName,
                            email: customerEmail || '',
                            phone: customerPhone || '',
                            address: customerAddress || '',
                        }
                        : undefined,
                })),
                total,
            };
        },
        ['action-orders-page', storeId, String(offset), String(limit), search, filterStatus],
        { tags: [`orders:${storeId}`], revalidate: 60 }
    )();

export async function getOrdersAction(
    storeId: string, 
    offset: number = 0, 
    limit: number = 10, 
    search: string = '', 
    filterStatus: string = 'all'
) {
    try {
        const access = await requireStoreAccess(storeId);
        if (!access.ok) return { success: false, error: access.error };

        const { orders: cachedOrders, total } = await fetchCachedOrders(storeId, offset, limit, search, filterStatus);

        return { 
            success: true, 
            orders: cachedOrders.map((o) => ({
                ...o,
                date: new Date(o.date),
            })),
            hasMore: total > (offset + cachedOrders.length),
            total
        };
    } catch (error: unknown) {
        console.error('Error getting orders with Drizzle:', error);
        return { success: false, orders: [], hasMore: false, total: 0, error: error instanceof Error ? error.message : String(error) };
    }
}
