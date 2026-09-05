'use server'

import { db } from '@/db'
import { stores, products, productStats, productReviews, orders, orderItems, customers, buyerAddresses, profiles } from '@/db/schema'
import { eq, sql, and, or, desc, inArray } from 'drizzle-orm'
import { unstable_cache, updateTag } from 'next/cache'
import { getCurrentSession } from '@/app/actions/session'
import { StoreData, BusinessVertical } from '@/types'

const CATALOG_TAG = 'marketplace'

type CheckoutStoreOrder = {
  items?: Array<{
    product?: { id?: string; price?: number | string } | null;
    price?: number | string;
    quantity?: number;
  }>;
  subtotal?: number | string;
  discountAmount?: number | string;
  total?: number | string;
  promoCode?: string | null;
  paymentMethod?: string;
}

type CheckoutCustomer = {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
}

type SaveAddressPayload = {
  id?: string;
  name: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  isDefault: boolean;
}

type ReviewPayload = {
  rating: number;
  comment?: string;
  author?: string;
  authorName?: string;
}

async function fetchMarketplaceDataUncached(): Promise<StoreData[]> {
  try {
    const [storesData, productsData, productStatsData] = await Promise.all([
      db
        .select({
          id: stores.id,
          userId: stores.userId,
          name: stores.name,
          slug: stores.slug,
          email: stores.email,
          phone: stores.phone,
          address: stores.address,
          ninea: stores.ninea,
          description: stores.description,
          views: stores.views,
          settings: sql<
            Record<string, unknown> | null
          >`${stores.settings} - 'logo'`,
          hasLogo: sql<boolean>`(${stores.settings} -> 'logo') IS NOT NULL`,
        })
        .from(stores),
      db
        .select({
          id: products.id,
          storeId: products.storeId,
          name: products.name,
          description: products.description,
          price: products.price,
          originalPrice: products.originalPrice,
          stock: products.stock,
          mainCategory: products.mainCategory,
          businessType: products.businessType,
          wholesalePrice: products.wholesalePrice,
          wholesaleMinQty: products.wholesaleMinQty,
          wholesaleTiers: products.wholesaleTiers,
          isOnline: products.isOnline,
          views: products.views,
          image: sql<
            string | null
          >`CASE WHEN ${products.image} LIKE 'data:%' THEN NULL ELSE ${products.image} END`,
          images: products.images,
          unit: products.unit,
          deliveryTime: products.deliveryTime,
          preparationTime: products.preparationTime,
          hasImage: sql<boolean>`${products.image} IS NOT NULL`,
        })
        .from(products)
        .where(eq(products.isOnline, true)),
      db.select().from(productStats).catch(() => [])
    ]);

    const toImageRef = (
      uri: string | null | undefined,
      hasImage: boolean | null | undefined,
      apiId: string
    ): string =>
      uri || (hasImage ? `/api/image/${apiId}` : '');

    const productStatsMap = Object.fromEntries((productStatsData || []).map((s) => [s.productId, s]));

    const productsByStoreMap: Record<string, Array<(typeof productsData)[number]>> = {};
    (productsData || []).forEach((p) => {
      if (!productsByStoreMap[p.storeId]) productsByStoreMap[p.storeId] = [];
      productsByStoreMap[p.storeId].push(p);
    });

    const marketplaceStores: StoreData[] = (storesData || []).map((s) => {
      const settingsObj: Record<string, unknown> = { ...(s.settings || {}) };
      if (s.hasLogo) {
        settingsObj.logo = `/api/image/s${s.id}`;
      }
      const description = String(s.description || settingsObj.description || '');
      
      return {
        id: s.id,
        slug: s.slug,
        ownerId: s.userId,
        description: description,
        views: s.views || 0,
        rating: 0,
        reviewCount: 0,
        settings: {
          name: s.name,
          email: s.email || '',
          phone: s.phone || '',
          address: s.address || '',
          ninea: s.ninea || '',
          description: description,
          ...(settingsObj as Partial<StoreData['settings']>)
        },
        products: (productsByStoreMap[s.id] || [])
          .map((p) => {
            const stats = productStatsMap[p.id];
            return {
              id: p.id,
              name: p.name,
              price: Number(p.price) || 0,
              originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
              image: toImageRef(p.image, p.hasImage, p.id),
              images: Array.isArray(p.images)
                ? (p.images as string[]).map((img) => toImageRef(img, p.hasImage, p.id))
                : undefined,
              unit: p.unit || undefined,
              deliveryTime: p.deliveryTime || undefined,
              preparationTime: p.preparationTime || undefined,
              stock: p.stock || 0,
              category: p.mainCategory || 'Autre',
              mainCategory: p.mainCategory || '',
              description: p.description || '',
              isOnline: p.isOnline !== false,
              views: p.views || 0,
              rating: stats?.averageRating ? parseFloat(stats.averageRating) : 0,
              reviewCount: stats?.reviewCount ? Number(stats.reviewCount) : 0,
              salesCount: stats?.totalSales ? Number(stats.totalSales) : 0,
              wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : undefined,
              wholesaleMinQty: p.wholesaleMinQty ?? undefined,
              wholesaleTiers: (p.wholesaleTiers as Array<{ minQty: number; price: number }>) || [],
              businessType: (p.businessType as BusinessVertical) || undefined
            };
          }),
        customers: [],
        orders: [],
        invoices: [],
        staff: []
      };
    });

    return marketplaceStores;
  } catch (error: unknown) {
    console.error('Error fetching marketplace data with Drizzle:', error);
    return [];
  }
}

const getCachedMarketplaceData = unstable_cache(fetchMarketplaceDataUncached, ['marketplace-catalog'], {
  tags: [CATALOG_TAG],
  revalidate: 300,
});

export async function fetchMarketplaceData(): Promise<StoreData[]> {
  return getCachedMarketplaceData();
}

export async function submitCheckoutAction(
  order: Record<string, CheckoutStoreOrder> = {},
  customerData?: CheckoutCustomer,
) {
  const ordersData = order;
  const customer = customerData || {};
  const { user } = await getCurrentSession();

  const createdOrderIds: string[] = [];
  try {
    for (const [storeId, storeOrder] of Object.entries(ordersData)) {
      const items = Array.isArray(storeOrder?.items) ? storeOrder.items : [];
      if (!storeOrder || items.length === 0) continue;

      // Upsert du client côté boutique (par téléphone) pour alimenter le CRM vendeur.
      let customerId: string | null = null;
      const phone = String(customer.phone || '').replace(/\D/g, '');
      if (phone) {
        const [existing] = await db
          .select({ id: customers.id })
          .from(customers)
          .where(and(eq(customers.storeId, storeId), eq(customers.phone, phone)))
          .limit(1);
        if (existing) {
          customerId = existing.id;
        } else {
          const [created] = await db
            .insert(customers)
            .values({
              storeId,
              name: customer.name || user?.email?.split('@')[0] || 'Client',
              phone,
              email: customer.email || user?.email || null,
              address: customer.address || null,
            })
            .returning({ id: customers.id });
          customerId = created.id;
        }
      }

      const subtotal = Number(storeOrder?.subtotal ?? 0);
      const discount = Number(storeOrder?.discountAmount ?? 0);
      const total = Number(storeOrder?.total ?? subtotal - discount);

      const [newOrder] = await db
        .insert(orders)
        .values({
          storeId,
          customerId,
          buyerUserId: user?.id || null,
          buyerEmail: user?.email || customer.email || null,
          status: 'COMPLETED',
          paymentMethod: storeOrder?.paymentMethod || 'ESPECES',
          type: 'ONLINE',
          subtotal: String(subtotal),
          discountAmount: String(discount || 0),
          promoCode: storeOrder?.promoCode || null,
          total: String(total),
          date: new Date(),
        })
        .returning({ id: orders.id });

      await db.insert(orderItems).values(
        items.map((item) => ({
          orderId: newOrder.id,
          productId: item.product?.id || null,
          quantity: Number(item.quantity || 1),
          unitPrice: String(item.product?.price ?? item.price ?? 0),
          total: String(
            Number(item.product?.price ?? item.price ?? 0) * Number(item.quantity || 1)
          ),
        }))
      );

      createdOrderIds.push(newOrder.id);
    }

    return {
      success: true,
      orderId: createdOrderIds[0],
      orderIds: createdOrderIds,
      error: undefined,
    };
  } catch (error) {
    console.error('Error persisting marketplace order:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de la validation de la commande';
    return { success: false, error: message };
  }
}

const normalizeImageUrl = (uri: string | null | undefined): string => {
  if (!uri) return '';
  if (uri.startsWith('data:')) return '';
  return uri;
};

const resolveCurrentBuyer = async () => {
  const { user } = await getCurrentSession();
  if (!user?.id) return { user: null };
  const [profile] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      phone: profiles.phone,
      companyName: profiles.companyName,
      ninea: profiles.ninea,
      createdAt: profiles.createdAt
    })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);
  return { user: profile || null };
};

export async function saveProductReviewAction(
  storeId: string,
  productId: string,
  reviewData?: ReviewPayload,
) {
  try {
    const data: Partial<ReviewPayload> = reviewData || {};

    if (!storeId || !productId) {
      return { success: false, error: 'Données d\'avis invalides' };
    }

    const rating = Math.min(5, Math.max(1, Number(data.rating) || 5));
    const { user } = await resolveCurrentBuyer();

    const [review] = await db
      .insert(productReviews)
      .values({
        storeId,
        productId,
        userId: user?.id || null,
        authorName: user ? (user.fullName || user.email?.split('@')[0] || 'Client') : (data.author || data.authorName || 'Anonyme'),
        rating,
        comment: data.comment || '',
      })
      .returning();

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productReviews)
      .where(eq(productReviews.productId, productId));

    const [avgRow] = await db
      .select({ avg: sql<string>`avg(rating)` })
      .from(productReviews)
      .where(eq(productReviews.productId, productId));

    const avg = Number(avgRow?.avg || rating);

    await db
      .insert(productStats)
      .values({
        storeId,
        productId,
        averageRating: avg.toFixed(2),
        reviewCount: Number(count),
        totalSales: 0,
      })
      .onConflictDoUpdate({
        target: productStats.productId,
        set: { averageRating: avg.toFixed(2), reviewCount: Number(count) },
      });

    updateTag(CATALOG_TAG);

    return { success: true, error: undefined, review };
  } catch (error) {
    console.error('Error saving review:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement de l\'avis';
    return { success: false, error: message };
  }
}

export async function notifyCartInterestAction(data: unknown) {
  return { success: true, error: undefined };
}

export async function notifyPostCheckoutAction(data: unknown) {
  return { success: true, error: undefined };
}

export async function fetchBuyerOrdersAction(page: number = 1, pageSize: number = 10) {
  const { user } = await resolveCurrentBuyer();
  if (!user) return { success: false, error: 'Unauthorized', orders: [], totalCount: 0 };

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(50, Math.max(1, Number(pageSize) || 10));

  try {
    const buyerWhere = or(
      eq(orders.buyerUserId, user.id),
      and(eq(orders.buyerEmail, user.email), sql`${orders.buyerUserId} IS NULL`)
    );

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(buyerWhere);

    const rows = await db
      .select({
        id: orders.id,
        date: orders.date,
        total: orders.total,
        subtotal: orders.subtotal,
        status: orders.status,
        paymentMethod: orders.paymentMethod,
        storeId: orders.storeId,
        storeName: stores.name,
        storeBusinessType: stores.businessType,
      })
      .from(orders)
      .innerJoin(stores, eq(orders.storeId, stores.id))
      .where(buyerWhere)
      .orderBy(desc(orders.date))
      .limit(safePageSize)
      .offset((safePage - 1) * safePageSize);

    const orderIds = rows.map((o) => o.id);
    const itemsByOrder: Record<string, OrderItemRow[]> = {};
    if (orderIds.length > 0) {
      const items = await db
        .select({
          id: orderItems.id,
          orderId: orderItems.orderId,
          quantity: orderItems.quantity,
          unitPrice: orderItems.unitPrice,
          productId: products.id,
          productName: products.name,
          productImage: products.image,
          productBusinessType: products.businessType,
        })
        .from(orderItems)
        .leftJoin(products, eq(orderItems.productId, products.id))
        .where(inArray(orderItems.orderId, orderIds));
      items.forEach((it) => {
        if (!itemsByOrder[it.orderId]) itemsByOrder[it.orderId] = [];
        itemsByOrder[it.orderId].push(it);
      });
    }

    return {
      success: true,
      error: undefined,
      totalCount: Number(count) || 0,
      orders: rows.map((o) => ({
        id: o.id,
        date: o.date instanceof Date ? o.date.toISOString() : String(o.date || ''),
        total: Number(o.total) || 0,
        subtotal: Number(o.subtotal) || 0,
        status: o.status || 'PENDING',
        paymentMethod: o.paymentMethod || '',
        store_id: o.storeId,
        stores: [{ name: o.storeName, business_type: o.storeBusinessType }],
        order_items: (itemsByOrder[o.id] || []).map((i) => ({
          id: i.id,
          quantity: Number(i.quantity) || 0,
          price: Number(i.unitPrice) || 0,
          products: i.productId
            ? [{
                id: i.productId,
                name: i.productName || 'Produit',
                image: normalizeImageUrl(i.productImage),
                business_type: i.productBusinessType || undefined,
              }]
            : [],
        })),
      })),
    };
  } catch (error) {
    console.error('Error fetching buyer orders:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors du chargement des commandes';
    return { success: false, error: message, orders: [], totalCount: 0 };
  }
}

type OrderItemRow = {
  id: string;
  orderId: string;
  quantity: string | number | null;
  unitPrice: string | number | null;
  productId: string | null;
  productName: string | null;
  productImage: string | null;
  productBusinessType: string | null;
}

export async function fetchBuyerAddressesAction() {
  const { user } = await resolveCurrentBuyer();
  if (!user) return { success: false, error: 'Unauthorized', addresses: [] };

  try {
    const rows = await db
      .select()
      .from(buyerAddresses)
      .where(eq(buyerAddresses.userId, user.id))
      .orderBy(desc(buyerAddresses.isDefault), desc(buyerAddresses.createdAt));

    return {
      success: true,
      error: undefined,
      addresses: rows.map((a) => ({
        id: a.id,
        name: a.name,
        full_name: a.fullName,
        phone: a.phone,
        address: a.address,
        city: a.city,
        is_default: a.isDefault,
      })),
    };
  } catch (error) {
    console.error('Error fetching buyer addresses:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors du chargement des adresses';
    return { success: false, error: message, addresses: [] };
  }
}

export async function saveBuyerAddressAction(address: SaveAddressPayload) {
  const { user } = await resolveCurrentBuyer();
  if (!user) return { success: false, error: 'Unauthorized' };

  const data = address || {};
  const name = String(data.name || '').trim();
  const fullName = String(data.fullName || '').trim();
  const phone = String(data.phone || '').trim();
  const addr = String(data.address || '').trim();
  const city = String(data.city || '').trim();
  const isDefault = Boolean(data.isDefault);

  if (!name || !fullName || !phone || !addr || !city) {
    return { success: false, error: 'Tous les champs sont obligatoires' };
  }

  try {
    await db.transaction(async (tx) => {
      if (isDefault) {
        await tx
          .update(buyerAddresses)
          .set({ isDefault: false })
          .where(eq(buyerAddresses.userId, user.id));
      }

      if (data.id) {
        await tx
          .update(buyerAddresses)
          .set({ name, fullName, phone, address: addr, city, isDefault })
          .where(and(eq(buyerAddresses.id, data.id), eq(buyerAddresses.userId, user.id)));
      } else {
        await tx.insert(buyerAddresses).values({
          userId: user.id,
          name,
          fullName,
          phone,
          address: addr,
          city,
          isDefault,
        });
      }
    });
    return { success: true, error: undefined };
  } catch (error) {
    console.error('Error saving buyer address:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement de l\'adresse';
    return { success: false, error: message };
  }
}

export async function deleteBuyerAddressAction(id: string) {
  const { user } = await resolveCurrentBuyer();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    await db
      .delete(buyerAddresses)
      .where(and(eq(buyerAddresses.id, id), eq(buyerAddresses.userId, user.id)));
    return { success: true, error: undefined };
  } catch (error) {
    console.error('Error deleting buyer address:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de la suppression de l\'adresse';
    return { success: false, error: message };
  }
}

export async function fetchBuyerReviewsAction() {
  const { user } = await resolveCurrentBuyer();
  if (!user) return { success: false, error: 'Unauthorized', reviews: [] };

  try {
    const rows = await db
      .select({
        id: productReviews.id,
        rating: productReviews.rating,
        comment: productReviews.comment,
        createdAt: productReviews.createdAt,
        storeName: stores.name,
        productId: products.id,
        productName: products.name,
        productImage: products.image,
        productBusinessType: products.businessType,
      })
      .from(productReviews)
      .innerJoin(stores, eq(productReviews.storeId, stores.id))
      .innerJoin(products, eq(productReviews.productId, products.id))
      .where(eq(productReviews.userId, user.id))
      .orderBy(desc(productReviews.createdAt));

    return {
      success: true,
      error: undefined,
      reviews: rows.map((r) => ({
        id: r.id,
        rating: Number(r.rating) || 0,
        comment: r.comment || '',
        date: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt || ''),
        stores: [{ name: r.storeName }],
        products: [{
          id: r.productId,
          name: r.productName || 'Produit',
          image: normalizeImageUrl(r.productImage),
          business_type: r.productBusinessType || undefined,
        }],
      })),
    };
  } catch (error) {
    console.error('Error fetching buyer reviews:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors du chargement des avis';
    return { success: false, error: message, reviews: [] };
  }
}

export async function updateBuyerProfileAction(updates: {
  fullName?: string;
  phone?: string;
  companyName?: string;
  ninea?: string;
}) {
  const { user } = await resolveCurrentBuyer();
  if (!user) return { success: false, error: 'Unauthorized' };

  const fullName = String(updates?.fullName || '').trim();
  const phone = String(updates?.phone || '').trim();
  const companyName = String(updates?.companyName || '').trim();
  const ninea = String(updates?.ninea || '').trim();

  if (fullName && fullName.length < 2) {
    return { success: false, error: 'Le nom doit contenir au moins 2 caractères' };
  }

  const patch: Record<string, unknown> = {};
  if (fullName) patch.fullName = fullName;
  if (typeof updates?.phone !== 'undefined') patch.phone = phone || null;
  if (typeof updates?.companyName !== 'undefined') patch.companyName = companyName || null;
  if (typeof updates?.ninea !== 'undefined') patch.ninea = ninea || null;

  if (Object.keys(patch).length === 0) {
    return { success: false, error: 'Aucune modification à enregistrer' };
  }

  try {
    const [profile] = await db
      .update(profiles)
      .set(patch)
      .where(eq(profiles.id, user.id))
      .returning({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        phone: profiles.phone,
        companyName: profiles.companyName,
        ninea: profiles.ninea,
      });
    return {
      success: true,
      error: undefined,
      user: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        phone: profile.phone || '',
        companyName: profile.companyName || '',
        ninea: profile.ninea || '',
      },
    };
  } catch (error) {
    console.error('Error updating buyer profile:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de la mise à jour du profil';
    return { success: false, error: message };
  }
}

export async function fetchBuyerProfileAction() {
  const { user } = await resolveCurrentBuyer();
  if (!user) return { success: false, error: 'Unauthorized' };
  return {
    success: true,
    error: undefined,
    profile: {
      email: user.email,
      fullName: user.fullName || user.email?.split('@')[0] || 'Utilisateur',
      phone: user.phone || '',
      companyName: user.companyName || '',
      ninea: user.ninea || '',
    },
  };
}
