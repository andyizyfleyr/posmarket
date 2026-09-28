'use server'

import { updateTag } from 'next/cache'
import { uploadDataUriToR2 } from '@/lib/r2'
import { db } from '@/db'
import { products, profiles } from '@/db/schema'
import { eq, and, sql, inArray, desc } from 'drizzle-orm'
import { createClient } from '@/utils/supabase/server'

type ProductInput = {
  id?: string;
  name?: string;
  price?: string | number;
  originalPrice?: string | number;
  original_price?: string | number;
  category?: string;
  image?: string | null;
  images?: string[];
  unit?: string;
  deliveryTime?: string;
  preparationTime?: string;
  stock?: number;
  mainCategory?: string;
  main_category?: string;
  description?: string | null;
  isOnline?: boolean;
  wholesalePrice?: string | number;
  wholesaleMinQty?: number;
  wholesaleTiers?: Array<{ minQty: number; price: number }>;
  businessType?: string;
  options?: unknown[];
  variants?: unknown[];
};

export async function saveProductAction(product: ProductInput, storeId: string) {
  try {
    // 1. Check Limits for NEW products
    if (!product.id) {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Non authentifié' };

      const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
      const [{ count: productsCount }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(products)
        .where(eq(products.storeId, storeId));

      const tier = profile?.subscriptionTier;
      const limit = tier === 'STARTER' ? 50 : tier === 'PRO' ? 500 : tier === 'ENTERPRISE' ? 999999 : 50;

      if (Number(productsCount) >= limit) {
        return { success: false, error: `Limite de ${limit} produits atteinte pour votre abonnement ${tier}.` };
      }
    }

    const uploadCache = new Map<string, string>();
    const resolveImage = async (img: string): Promise<string> => {
      if (!img.startsWith('data:')) return img;
      const cached = uploadCache.get(img);
      if (cached) return cached;
      const r2Url = await uploadDataUriToR2(img, 'products').catch(() => null);
      const resolved = r2Url || img;
      uploadCache.set(img, resolved);
      return resolved;
    };

    const sourceImages: string[] = (
      Array.isArray(product.images) && product.images.length > 0
        ? product.images
        : product.image
          ? [product.image]
          : []
    ).filter((img): img is string => typeof img === 'string' && !!img);

    if (product.image && !sourceImages.includes(product.image)) {
      sourceImages.unshift(product.image);
    }

    const imagesValue: string[] = [];
    for (const source of sourceImages) {
      const resolved = await resolveImage(source);
      if (!imagesValue.includes(resolved)) imagesValue.push(resolved);
    }

    let imageValue: string | null = imagesValue[0] ?? null;
    if (!imageValue && product.image) {
      imageValue = await resolveImage(product.image);
    }

    const dataToSave = {
      storeId,
      name: product.name || '',
      price: product.price?.toString() || '0',
      originalPrice: (product.originalPrice || product.original_price)?.toString(),
      category: product.category,
      image: imageValue,
      images: imagesValue,
      unit: product.unit || null,
      deliveryTime: product.deliveryTime || null,
      preparationTime: product.preparationTime || null,
      stock: Math.round(product.stock ?? 0),
      mainCategory: product.mainCategory || product.main_category,
      description: product.description,
      isOnline: product.isOnline !== undefined ? product.isOnline : true,
      wholesalePrice: product.wholesalePrice?.toString(),
      wholesaleMinQty: product.wholesaleMinQty,
      wholesaleTiers: product.wholesaleTiers || [],
      businessType: product.businessType || 'shopping',
      options: product.options || [],
      variants: product.variants || []
    };

    let savedProduct;
    if (product.id && !product.id.startsWith('temp-')) {
      [savedProduct] = await db
        .update(products)
        .set(dataToSave)
        .where(eq(products.id, product.id))
        .returning();
    } else {
      [savedProduct] = await db
        .insert(products)
        .values(dataToSave)
        .returning();
    }

    if (!savedProduct) return { success: false, error: 'Produit introuvable' };

    updateTag('marketplace');

    const safe = {
      id: savedProduct.id,
      storeId: savedProduct.storeId,
      name: savedProduct.name,
      price: Number(savedProduct.price) || 0,
      originalPrice: savedProduct.originalPrice ? Number(savedProduct.originalPrice) : null,
      stock: Number(savedProduct.stock) || 0,
      category: savedProduct.category,
      mainCategory: savedProduct.mainCategory,
      image: savedProduct.image,
      images: (savedProduct.images as string[]) || [],
      unit: savedProduct.unit || undefined,
      deliveryTime: savedProduct.deliveryTime || undefined,
      preparationTime: savedProduct.preparationTime || undefined,
      description: savedProduct.description,
      isOnline: savedProduct.isOnline,
      views: Number(savedProduct.views) || 0,
      wholesalePrice: savedProduct.wholesalePrice ? Number(savedProduct.wholesalePrice) : null,
      wholesaleMinQty: savedProduct.wholesaleMinQty,
      wholesaleTiers: (savedProduct.wholesaleTiers as Array<{ minQty: number; price: number }>) || [],
      businessType: savedProduct.businessType,
      options: savedProduct.options || [],
      variants: savedProduct.variants || [],
      createdAt: savedProduct.createdAt?.toISOString?.() || null,
    };

    return { success: true, product: safe };
  } catch (error: unknown) {
    console.error('Error saving product with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await db.delete(products).where(eq(products.id, id));
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting product with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function bulkDeleteProductsAction(ids: string[]) {
  try {
    if (ids.length > 0) {
      await db.delete(products).where(inArray(products.id, ids));
    }
    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error bulk deleting products with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function getProductsAction(
  storeId: string, 
  offset: number = 0, 
  limit: number = 10, 
  search: string = '',
  options: { productType?: 'all' | 'pos' | 'marketplace', businessType?: 'all' | 'shopping' | 'food' } = {}
) {
  try {
    const conditions = [eq(products.storeId, storeId)];

    if (options.productType && options.productType !== 'all') {
      if (options.productType === 'pos') {
        conditions.push(eq(products.isOnline, false));
      } else if (options.productType === 'marketplace') {
        conditions.push(eq(products.isOnline, true));
      }
    }

    if (options.businessType && options.businessType !== 'all') {
      conditions.push(eq(products.businessType, options.businessType));
    }

    if (search) {
      conditions.push(sql`${products.name} ILIKE ${`%${search}%`}`);
    }

    const whereClause = and(...conditions);

    const [productsList, [{ count: totalCount }]] = await Promise.all([
      db.select()
        .from(products)
        .where(whereClause)
        .orderBy(desc(products.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)` })
        .from(products)
        .where(whereClause)
    ]);

    const total = Number(totalCount) || 0;

    return {
      success: true,
      products: (productsList || []).map((p) => ({
        ...p,
        price: parseFloat(p.price ?? '') || 0,
        originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : undefined,
        isOnline: p.isOnline !== false,
        wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : undefined,
        wholesaleMinQty: p.wholesaleMinQty,
        mainCategory: p.mainCategory,
        businessType: p.businessType,
        options: p.options || [],
        variants: p.variants || []
      })),
      hasMore: total > (offset + productsList.length),
      total
    };
  } catch (error: unknown) {
    console.error('Error fetching products with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error), products: [], total: 0 };
  }
}

export async function getStockCountsAction(storeId: string): Promise<{ ok: boolean; stock?: Record<string, number>; error?: string }> {
  try {
    const rows = await db.select({ id: products.id, stock: products.stock }).from(products).where(eq(products.storeId, storeId));
    const stock: Record<string, number> = {};
    for (const r of rows) stock[r.id] = Number(r.stock ?? 0);
    return { ok: true, stock };
  } catch (error: unknown) {
    console.error('Error fetching stock counts with Drizzle:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
