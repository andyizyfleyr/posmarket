'use server'

import { db } from '@/db'
import { stores, products, productStats, productReviews } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { unstable_cache, updateTag } from 'next/cache'
import { StoreData } from '@/types'

const CATALOG_TAG = 'marketplace'

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
          isOnline: products.isOnline,
          views: products.views,
          image: sql<
            string | null
          >`CASE WHEN ${products.image} LIKE 'data:%' THEN NULL ELSE ${products.image} END`,
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

    const productStatsMap = Object.fromEntries((productStatsData || []).map((s: any) => [s.productId, s]));

    const productsByStoreMap: Record<string, any[]> = {};
    (productsData || []).forEach((p: any) => {
      if (!productsByStoreMap[p.storeId]) productsByStoreMap[p.storeId] = [];
      productsByStoreMap[p.storeId].push(p);
    });

    const marketplaceStores: StoreData[] = (storesData || []).map((s: any) => {
      const settingsObj: Record<string, unknown> = { ...(s.settings || {}) };
      if (s.hasLogo) {
        settingsObj.logo = `/api/image/s${s.id}`;
      }
      const description = s.description || settingsObj.description || '';
      
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
          ...settingsObj
        },
        products: (productsByStoreMap[s.id] || [])
          .map((p: any) => {
            const stats = productStatsMap[p.id] || {};
            return {
              id: p.id,
              name: p.name,
              price: Number(p.price) || 0,
              originalPrice: p.originalPrice ? Number(p.originalPrice) : undefined,
              image: toImageRef(p.image, p.hasImage, p.id),
              stock: p.stock || 0,
              mainCategory: p.mainCategory || '',
              description: p.description || '',
              isOnline: p.isOnline !== false,
              views: p.views || 0,
              rating: stats.averageRating ? parseFloat(stats.averageRating) : 0,
              reviewCount: stats.reviewCount ? parseInt(stats.reviewCount) : 0,
              salesCount: stats.totalSales ? parseInt(stats.totalSales) : 0,
              wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : undefined,
              wholesaleMinQty: p.wholesaleMinQty,
              businessType: p.businessType
            };
          }),
        customers: [],
        orders: [],
        invoices: [],
        staff: []
      } as any;
    });

    return marketplaceStores;
  } catch (error: any) {
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

export async function submitCheckoutAction(order: any) {
  return { success: true, orderId: 'ord_' + Math.random().toString(36).substring(2, 9) };
}

export async function saveProductReviewAction(storeIdOrReview: any, productId?: string, reviewData?: any) {
  try {
    const storeId = typeof storeIdOrReview === 'string' ? storeIdOrReview : storeIdOrReview?.storeId;
    const pid = typeof storeIdOrReview === 'string' ? productId : storeIdOrReview?.productId;
    const data = typeof storeIdOrReview === 'string' ? reviewData : storeIdOrReview;

    if (!storeId || !pid || !data) {
      return { success: false, error: 'Données d\'avis invalides' };
    }

    const rating = Math.min(5, Math.max(1, Number(data.rating) || 5));

    const [review] = await db
      .insert(productReviews)
      .values({
        storeId,
        productId: pid,
        authorName: data.author || data.authorName || 'Anonyme',
        rating,
        comment: data.comment || '',
      })
      .returning();

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(productReviews)
      .where(eq(productReviews.productId, pid));

    const [avgRow] = await db
      .select({ avg: sql<string>`avg(rating)` })
      .from(productReviews)
      .where(eq(productReviews.productId, pid));

    const avg = Number(avgRow?.avg || rating);

    await db
      .insert(productStats)
      .values({
        storeId,
        productId: pid,
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
  } catch (error: any) {
    console.error('Error saving review:', error);
    return { success: false, error: error.message };
  }
}

export async function notifyCartInterestAction(data: any) {
  return { success: true, error: undefined };
}

export async function notifyPostCheckoutAction(data: any) {
  return { success: true, error: undefined };
}

export async function fetchBuyerOrdersAction(page: number = 1, pageSize: number = 10) {
  return { success: true, orders: [], totalCount: 0, error: undefined };
}

export async function fetchBuyerAddressesAction() {
  return { success: true, addresses: [], error: undefined };
}

export async function saveBuyerAddressAction(address: any) {
  return { success: true, error: undefined };
}

export async function deleteBuyerAddressAction(id: string) {
  return { success: true, error: undefined };
}

export async function fetchBuyerReviewsAction() {
  return { success: true, reviews: [], error: undefined };
}
