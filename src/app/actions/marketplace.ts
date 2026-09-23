'use server'

import { db } from '@/db'
import { stores, products, productStats, productReviews, orders, orderItems, customers, buyerAddresses, profiles } from '@/db/schema'
import { eq, sql, and, or, desc, inArray } from 'drizzle-orm'
import { unstable_cache, updateTag } from 'next/cache'
import { getCurrentSession } from '@/app/actions/session'
import { incrementProductSales } from '@/db/api'
import { notify, getStorePhone } from '@/lib/notifications'
import { orderEmailProducts } from '@/lib/email'
import { detectClientCountry, isCountryAllowed, getSupportedCountriesLabel } from '@/lib/geo'
import { generateProductSlug } from '@/utils/slug'
import { StoreData, BusinessVertical, ProductOption, ProductVariant, WholesaleTier } from '@/types'

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
  userId?: string;
  email?: string;
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
    const [storesData, productsData, productStatsData, salesCountsData, reviewsAggData] = await Promise.all([
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
          hasLogo: sql<boolean>`TRIM(COALESCE(${stores.settings}->>'logo','')) <> ''`,
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
          options: products.options,
          variants: products.variants,
          hasImage: sql<boolean>`${products.image} IS NOT NULL`,
        })
        .from(products)
        .where(eq(products.isOnline, true)),
      db.select().from(productStats).catch(() => []),
      db
        .select({
          productId: orderItems.productId,
          totalSales: sql<number>`COALESCE(SUM(${orderItems.quantity}), 0)::int`,
        })
        .from(orderItems)
        .where(sql`${orderItems.productId} IS NOT NULL`)
        .groupBy(orderItems.productId)
        .catch(() => []),
      db
        .select({
          storeId: productReviews.storeId,
          averageRating: sql<string>`COALESCE(ROUND(AVG(${productReviews.rating})::numeric, 2), 0)::text`,
          reviewCount: sql<number>`COUNT(${productReviews.id})::int`,
        })
        .from(productReviews)
        .groupBy(productReviews.storeId)
        .catch(() => []),
    ]);

    const toImageRef = (
      uri: string | null | undefined,
      hasImage: boolean | null | undefined,
      apiId: string
    ): string =>
      uri || (hasImage ? `/api/image/${apiId}` : '');

    const productStatsMap = Object.fromEntries((productStatsData || []).map((s) => [s.productId, s]));
    const orderSalesMap = Object.fromEntries(
      (salesCountsData || [])
        .filter((s) => s.productId)
        .map((s) => [s.productId!, Number(s.totalSales) || 0])
    );
    const storeReviewsMap = Object.fromEntries(
      (reviewsAggData || []).map((r) => [
        r.storeId,
        {
          rating: Number(r.averageRating) || 0,
          reviewCount: Number(r.reviewCount) || 0,
        },
      ])
    );

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
        rating: storeReviewsMap[s.id]?.rating || 0,
        reviewCount: storeReviewsMap[s.id]?.reviewCount || 0,
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
            const realSales = Math.max(Number(orderSalesMap[p.id] || 0), Number(stats?.totalSales || 0));
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
              salesCount: realSales,
              wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : undefined,
              wholesaleMinQty: p.wholesaleMinQty ?? undefined,
              wholesaleTiers: Array.isArray(p.wholesaleTiers) ? (p.wholesaleTiers as Array<{ minQty: number; price: number }>) : [],
              options: Array.isArray(p.options) ? (p.options as ProductOption[]) : [],
              variants: Array.isArray(p.variants) ? (p.variants as ProductVariant[]) : [],
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
  revalidate: 60,
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

  // Pays du client (IP) — blocage autoritaire : on ne crée aucune commande
  // si le pays détecté n'est pas desservi. Non bypassable côté navigateur.
  const countryGate = await detectClientCountry();
  if (countryGate.detected && countryGate.code && !isCountryAllowed(countryGate.code)) {
    return {
      success: false,
      error: `Commande impossible : nous livrons actuellement uniquement au ${getSupportedCountriesLabel()}. Votre connexion indique un autre pays.`,
    };
  }

  const createdOrderIds: string[] = [];
  try {
    for (const [storeId, storeOrder] of Object.entries(ordersData)) {
      const items = Array.isArray(storeOrder?.items) ? storeOrder.items : [];
      if (!storeOrder || items.length === 0) continue;

      // Upsert du client côté boutique (par téléphone) pour alimenter le CRM vendeur.
      let customerId: string | null = null;
      let customerCreated = false;
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
          customerCreated = true;
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
          status: 'PENDING',
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
          unitPrice: String(item.price ?? item.product?.price ?? 0),
          total: String(
            Number(item.price ?? item.product?.price ?? 0) * Number(item.quantity || 1)
          ),
        }))
      );

      await incrementProductSales(
        storeId,
        items.map((item) => ({
          productId: item.product?.id || null,
          quantity: Number(item.quantity || 1),
        }))
      );

      // --- Notifications WhatsApp (best-effort, ne bloque jamais la commande) ---
      try {
        const storeInfo = await getStorePhone(storeId);
        const shortId = newOrder.id.slice(0, 8).toUpperCase();
        const totalStr = new Intl.NumberFormat('fr-FR').format(Number(total) || 0);
        const buyerName = customer.name || String(customer.email || '').split('@')[0] || 'Client';
        const paymentMethod = storeOrder?.paymentMethod || 'ESPECES';
        const storeDisplayName = storeInfo?.name || 'boutique';
        const emailProducts = await orderEmailProducts(newOrder.id);

        if (storeInfo?.phone) {
          await notify({
            userId: storeInfo.ownerId,
            phone: storeInfo.phone,
            email: storeInfo.email || '',
            eventType: 'NOUVELLE_COMMANDE',
            title: 'Nouvelle commande',
            body: `Nouvelle commande #${shortId}\nClient : ${buyerName}\nTotal : ${totalStr} FCFA\nPaiement : ${paymentMethod === 'CARTE' ? 'Carte' : 'Espèces'}`,
            templateParams: [shortId, buyerName, totalStr],
            emailData: { order: shortId, buyer: buyerName, phone: customer.phone || phone || undefined, total: totalStr, payment: paymentMethod, paymentLabel: paymentMethod === 'CARTE' ? 'Carte' : 'Espèces', items: emailProducts.length || undefined, store: storeInfo?.name || '', storeSlug: storeInfo?.slug || '', products: emailProducts },
          });
          if (customerCreated) {
            await notify({
              userId: storeInfo.ownerId,
              phone: storeInfo.phone,
              email: storeInfo.email || '',
              eventType: 'NOUVEAU_CLIENT',
              title: 'Nouveau client',
              body: `Nouveau client enregistré : ${buyerName} (${phone})`,
              templateParams: [buyerName, phone],
              emailData: { buyer: buyerName, phone, store: storeInfo?.name || '', storeSlug: storeInfo?.slug || '' },
            });
          }
        }

        const buyerEmail = customer.email || user?.email || '';
        if (customer.phone || buyerEmail) {
          await notify({
            userId: user?.id || null,
            phone: customer.phone,
            email: buyerEmail,
            eventType: 'CONFIRMATION_COMMANDE',
            title: 'Commande confirmée',
            body: `Votre commande #${shortId} chez ${storeDisplayName} est confirmée. Total : ${totalStr} FCFA.`,
            templateParams: [shortId, storeDisplayName, totalStr],
            emailData: { order: shortId, store: storeDisplayName, storeSlug: storeInfo?.slug || '', total: totalStr, payment: paymentMethod, paymentLabel: paymentMethod === 'CARTE' ? 'Carte' : 'Espèces', items: emailProducts.length || undefined, products: emailProducts },
          });
        }

        const productIds = items.map((i) => i.product?.id).filter((x): x is string => Boolean(x));
        if (productIds.length > 0) {
          const lowProducts = await db
.select({ id: products.id, name: products.name, stock: products.stock })
          .from(products)
          .where(inArray(products.id, productIds));
        for (const p of lowProducts) {
          const stock = Number(p.stock) || 0;
          const productSlug = generateProductSlug({ id: p.id, name: p.name });
          if (stock === 0 && storeInfo?.phone) {
            await notify({
              userId: storeInfo.ownerId,
              phone: storeInfo.phone,
              email: storeInfo.email || '',
              eventType: 'RUPTURE_STOCK',
              title: 'Rupture de stock',
              body: `Rupture de stock : « ${p.name} » n'est plus disponible.`,
              templateParams: [p.name],
              emailData: { product: p.name, productSlug },
            });
          } else if (stock > 0 && stock <= 10 && storeInfo?.phone) {
            await notify({
              userId: storeInfo.ownerId,
              phone: storeInfo.phone,
              email: storeInfo.email || '',
              eventType: 'ALERTE_STOCK_BAS',
              title: 'Stock bas',
              body: `Stock bas : « ${p.name} » — plus que ${stock} en stock.`,
              templateParams: [p.name, String(stock)],
              emailData: { product: p.name, productSlug, stock },
            });
          }
        }
        }
      } catch (err) {
        console.error('[marketplace] notification error:', err);
      }

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

const resolveCurrentBuyer = async (fallbackIdOrEmail?: string) => {
  const { user: sessionUser } = await getCurrentSession();
  let targetId = sessionUser?.id;
  let targetEmail = sessionUser?.email;

  if (!targetId && fallbackIdOrEmail && typeof fallbackIdOrEmail === 'string') {
    const trimmed = fallbackIdOrEmail.trim();
    if (trimmed.includes('@')) {
      targetEmail = trimmed.toLowerCase();
    } else if (trimmed.length > 0) {
      targetId = trimmed;
    }
  }

  if (!targetId && !targetEmail) return { user: null };

  const conditions = [];
  if (targetId) conditions.push(eq(profiles.id, targetId));
  if (targetEmail) conditions.push(eq(profiles.email, targetEmail));

  let [profile] = await db
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
    .where(or(...conditions))
    .limit(1);

  if (!profile && targetEmail) {
    try {
      const [newProfile] = await db.insert(profiles).values({
        email: targetEmail,
        fullName: targetEmail.split('@')[0],
      }).returning({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        phone: profiles.phone,
        companyName: profiles.companyName,
        ninea: profiles.ninea,
        createdAt: profiles.createdAt
      });
      profile = newProfile;
    } catch {
      const [existing] = await db.select().from(profiles).where(eq(profiles.email, targetEmail)).limit(1);
      profile = existing || null;
    }
  }

  if (profile?.id) {
    // Identité acheteur désormais portée par la session Auth.js.
  }

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

    try {
      const storeInfo = await getStorePhone(storeId);
      if (storeInfo?.email) {
        const [prod] = await db.select({ id: products.id, name: products.name }).from(products).where(eq(products.id, productId)).limit(1);
        await notify({
          userId: storeInfo.ownerId,
          email: storeInfo.email,
          eventType: 'NOUVEL_AVIS',
          title: 'Nouvel avis',
          body: `Un nouvel avis (${rating}/5) a été publié sur un de vos produits.`,
          templateParams: [String(rating), String(count)],
          emailData: { rating, count, product: prod?.name || '', productSlug: prod ? generateProductSlug({ id: prod.id, name: prod.name }) : '', buyer: review.authorName || '' },
        });
      }
    } catch {}

    return { success: true, error: undefined, review };
  } catch (error) {
    console.error('Error saving review:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement de l\'avis';
    return { success: false, error: message };
  }
}

export async function notifyCartInterestAction(data: unknown) {
  const payload = (data || {}) as {
    phone?: string;
    userId?: string;
    name?: string;
    itemsCount?: number;
    total?: number | string;
  };
  const phone = String(payload.phone || '').trim();
  if (!phone) return { success: true, error: undefined };

  try {
    const retryAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await notify({
      userId: payload.userId || null,
      phone,
      eventType: 'RELANCE_PANIER_ABANDONNE',
      title: 'Votre panier vous attend',
      body: `Bonjour ${payload.name || 'vous'}, vous avez laissé ${payload.itemsCount || 'des articles'} dans votre panier (${Number(payload.total) || 0} FCFA). Revenez finaliser votre commande !`,
      templateParams: [payload.name || 'vous', String(payload.itemsCount || ''), String(Number(payload.total) || 0)],
      emailData: { name: payload.name || '', items: Number(payload.itemsCount) || 0, total: String(Number(payload.total) || 0) },
      scheduledAt: retryAt,
    });
    return { success: true, error: undefined };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Erreur relance panier' };
  }
}

export async function notifyPostCheckoutAction() {
  return { success: true, error: undefined };
}

export async function fetchBuyerOrdersAction(page: number = 1, pageSize: number = 10, fallbackIdOrEmail?: string) {
  const { user } = await resolveCurrentBuyer(fallbackIdOrEmail);
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

export async function fetchBuyerAddressesAction(fallbackIdOrEmail?: string) {
  const { user } = await resolveCurrentBuyer(fallbackIdOrEmail);
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
  const fallback = address?.userId || address?.email;
  const { user } = await resolveCurrentBuyer(fallback);
  if (!user) return { success: false, error: 'Unauthorized' };

  const data = address || {};
  const name = String(data.name || '').trim();
  const fullName = String(data.fullName || '').trim();
  const phone = String(data.phone || '').trim();
  const addr = String(data.address || '').trim();
  const city = String(data.city || '').trim();
  const isDefault = Boolean(data.isDefault);

  if (!name || !fullName || !phone) {
    return { success: false, error: 'Tous les champs obligatoires sont requis' };
  }

  try {
    if (isDefault) {
      await db
        .update(buyerAddresses)
        .set({ isDefault: false })
        .where(eq(buyerAddresses.userId, user.id));
    }

    if (data.id) {
      await db
        .update(buyerAddresses)
        .set({ name, fullName, phone, address: addr, city, isDefault })
        .where(and(eq(buyerAddresses.id, data.id), eq(buyerAddresses.userId, user.id)));
    } else {
      await db.insert(buyerAddresses).values({
        userId: user.id,
        name,
        fullName,
        phone,
        address: addr,
        city,
        isDefault,
      });
    }
    return { success: true, error: undefined };
  } catch (error) {
    console.error('Error saving buyer address:', error);
    const message = error instanceof Error ? error.message : 'Erreur lors de l\'enregistrement de l\'adresse';
    return { success: false, error: message };
  }
}

export async function deleteBuyerAddressAction(id: string, fallbackIdOrEmail?: string) {
  const { user } = await resolveCurrentBuyer(fallbackIdOrEmail);
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

export async function fetchBuyerReviewsAction(fallbackIdOrEmail?: string) {
  const { user } = await resolveCurrentBuyer(fallbackIdOrEmail);
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
}, fallbackIdOrEmail?: string) {
  const { user } = await resolveCurrentBuyer(fallbackIdOrEmail);
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

export async function fetchBuyerProfileAction(fallbackIdOrEmail?: string) {
  const { user } = await resolveCurrentBuyer(fallbackIdOrEmail);
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

export async function searchProductsAction(query: string, limit: number = 30) {
  // Normalize: trim, collapse spaces (accent handling done in SQL via unaccent)
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length < 2) {
    return { success: true, error: undefined, products: [] };
  }

  try {
    // Advanced CTE with 5 relevance layers:
    //  1. FTS ts_rank on search_vector (accent-insensitive via immutable_unaccent)   × 2.0
    //  2. pg_trgm similarity on unaccented name (typo tolerance)                     × 1.5
    //  3. pg_trgm similarity on unaccented description                               × 0.3
    //  4. Prefix bonus: name starts with query term                                  + 0.5
    //  5. Store name match (brand search: "Nike" → all Nike products)                × 0.8
    //  All multiplied by a log-damped popularity boost from product_stats
    //  Final filter: rank_score > 0.08 (eliminates garbage results)
    const rows = await db.execute(sql`
      WITH ranked AS (
        SELECT
          p.id,
          p.name,
          p.price,
          p.original_price,
          p.image,
          p.stock,
          p.main_category,
          p.store_id,
          p.is_online,
          p.business_type,
          p.wholesale_price,
          p.wholesale_tiers,
          p.views,
          s.name          AS store_name,
          s.slug          AS store_slug,
          COALESCE(ps.total_sales, 0)     AS total_sales,
          COALESCE(ps.average_rating, 0)  AS average_rating,
          COALESCE(ps.review_count, 0)    AS review_count,
          (
            -- 1. FTS relevance (unaccented — uses GIN index on search_vector)
            ts_rank(p.search_vector, websearch_to_tsquery('french', immutable_unaccent(${normalized}))) * 2.0

            -- 2. Trigram on unaccented name (typo tolerance)
            + similarity(immutable_unaccent(p.name), immutable_unaccent(${normalized})) * 1.5

            -- 3. Trigram on unaccented description (wider fuzzy surface)
            + similarity(immutable_unaccent(coalesce(p.description, '')), immutable_unaccent(${normalized})) * 0.3

            -- 4. Prefix bonus: query is a prefix of the product name → immediate match
            + CASE
                WHEN lower(immutable_unaccent(p.name)) LIKE lower(immutable_unaccent(${normalized})) || '%'
                THEN 0.5 ELSE 0
              END

            -- 5. Store name match: brand/store searches surface relevant products
            + similarity(immutable_unaccent(s.name), immutable_unaccent(${normalized})) * 0.8
          )
          -- Popularity boost: log-damped so viral products don't bury fresh ones
          * (1.0 + ln(1.0 + COALESCE(ps.total_sales, 0)::float * 3
                          + p.views::float * 0.1))
          AS rank_score
        FROM products p
        JOIN stores s ON s.id = p.store_id
        LEFT JOIN product_stats ps ON ps.product_id = p.id
        WHERE
          p.is_online = true
          AND (
            -- FTS match (unaccented)
            p.search_vector @@ websearch_to_tsquery('french', immutable_unaccent(${normalized}))
            -- Trigram fuzzy on name
            OR immutable_unaccent(p.name) % immutable_unaccent(${normalized})
            -- Trigram fuzzy on description
            OR immutable_unaccent(coalesce(p.description, '')) % immutable_unaccent(${normalized})
            -- ILIKE fallback (prefix / partial)
            OR p.name ILIKE ${'%' + normalized + '%'}
            -- Store name match
            OR s.name ILIKE ${'%' + normalized + '%'}
          )
      )
      SELECT * FROM ranked
      WHERE rank_score > 0.08
      ORDER BY rank_score DESC
      LIMIT ${limit}
    `);

    const products = (rows.rows as Record<string, unknown>[]).map((p) => ({
      id: p.id as string,
      name: p.name as string,
      price: Number(p.price),
      originalPrice: p.original_price ? Number(p.original_price) : undefined,
      image: (p.image as string) || '',
      stock: Number(p.stock) || 0,
      category: (p.main_category as string) || 'Autre',
      mainCategory: (p.main_category as string) || '',
      storeId: p.store_id as string,
      storeName: (p.store_name as string) || '',
      storeSlug: (p.store_slug as string) || undefined,
      isOnline: p.is_online !== false,
      businessType: ((p.business_type as string) || 'shopping') as BusinessVertical,
      wholesalePrice: p.wholesale_price ? Number(p.wholesale_price) : undefined,
      wholesaleTiers: Array.isArray(p.wholesale_tiers) ? (p.wholesale_tiers as WholesaleTier[]) : [],
      views: Number(p.views) || 0,
      salesCount: Number(p.total_sales) || 0,
      rating: Number(p.average_rating) || 0,
      reviewCount: Number(p.review_count) || 0,
      rankScore: Number(p.rank_score) || 0,
    }));

    return { success: true, error: undefined, products };
  } catch (error) {
    console.error('[searchProductsAction] error:', error);
    const message = error instanceof Error ? error.message : 'Erreur de recherche';
    return { success: false, error: message, products: [] };
  }
}

/** Lightweight autocomplete — returns up to 5 product name suggestions in < 50ms.
 *  Uses only pg_trgm + ILIKE (no JOIN to product_stats) for maximum speed. */
export async function searchSuggestionsAction(query: string) {
  const normalized = query.trim().replace(/\s+/g, ' ');
  if (!normalized || normalized.length < 2) {
    return { success: true, suggestions: [] };
  }

  try {
    const rows = await db.execute(sql`
      SELECT DISTINCT ON (lower(immutable_unaccent(p.name)))
        p.id,
        p.name,
        p.main_category,
        s.name AS store_name,
        similarity(immutable_unaccent(p.name), immutable_unaccent(${normalized})) AS sim
      FROM products p
      JOIN stores s ON s.id = p.store_id
      WHERE
        p.is_online = true
        AND (
          immutable_unaccent(p.name) % immutable_unaccent(${normalized})
          OR p.name ILIKE ${normalized + '%'}
          OR p.name ILIKE ${'%' + normalized + '%'}
        )
      ORDER BY lower(immutable_unaccent(p.name)), sim DESC
      LIMIT 5
    `);

    const suggestions = (rows.rows as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      name: r.name as string,
      category: (r.main_category as string) || '',
      storeName: (r.store_name as string) || '',
    }));

    return { success: true, suggestions };
  } catch (error) {
    console.error('[searchSuggestionsAction] error:', error);
    return { success: true, suggestions: [] }; // fail silently for autocomplete
  }
}

