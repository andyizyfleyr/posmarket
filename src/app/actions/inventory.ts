'use server'

import { updateTag } from 'next/cache'
import { uploadDataUriToR2 } from '@/lib/r2'
import { db } from '@/db'
import { products, profiles } from '@/db/schema'
import { eq, and, sql, inArray, desc } from 'drizzle-orm'
import { createClient } from '@/utils/supabase/server'

export async function saveProductAction(product: any, storeId: string) {
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

      const tier = profile?.subscriptionTier || 'PRO';
      const limit = tier === 'STARTER' ? 50 : tier === 'PRO' ? 500 : 999999;

      if (Number(productsCount) >= limit) {
        return { success: false, error: `Limite de ${limit} produits atteinte pour votre abonnement ${tier}.` };
      }
    }

    let imageValue = product.image;
    if (typeof imageValue === 'string' && imageValue.startsWith('data:')) {
      const r2Url = await uploadDataUriToR2(imageValue, 'products').catch(() => null);
      if (r2Url) imageValue = r2Url;
    }

    const dataToSave = {
      storeId,
      name: product.name,
      price: product.price?.toString() || '0',
      originalPrice: (product.originalPrice || product.original_price)?.toString(),
      category: product.category,
      image: imageValue,
      stock: Math.round(product.stock ?? 0),
      mainCategory: product.mainCategory || product.main_category,
      description: product.description,
      isOnline: product.isOnline !== undefined ? product.isOnline : true,
      wholesalePrice: product.wholesalePrice?.toString(),
      wholesaleMinQty: product.wholesaleMinQty,
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

    updateTag('marketplace');

    if (!savedProduct) return { success: false, error: 'Produit introuvable' };

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
      description: savedProduct.description,
      isOnline: savedProduct.isOnline,
      views: Number(savedProduct.views) || 0,
      wholesalePrice: savedProduct.wholesalePrice ? Number(savedProduct.wholesalePrice) : null,
      wholesaleMinQty: savedProduct.wholesaleMinQty,
      businessType: savedProduct.businessType,
      options: savedProduct.options || [],
      variants: savedProduct.variants || [],
      createdAt: savedProduct.createdAt?.toISOString?.() || null,
    };

    return { success: true, product: safe };
  } catch (error: any) {
    console.error('Error saving product with Drizzle:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteProductAction(id: string) {
  try {
    await db.delete(products).where(eq(products.id, id));
    updateTag('marketplace');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting product with Drizzle:', error);
    return { success: false, error: error.message };
  }
}

export async function bulkDeleteProductsAction(ids: string[]) {
  try {
    if (ids.length > 0) {
      await db.delete(products).where(inArray(products.id, ids));
    }
    updateTag('marketplace');
    return { success: true };
  } catch (error: any) {
    console.error('Error bulk deleting products with Drizzle:', error);
    return { success: false, error: error.message };
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
    let conditions = [eq(products.storeId, storeId)];

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
      products: (productsList || []).map((p: any) => ({
        ...p,
        price: parseFloat(p.price) || 0,
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
  } catch (error: any) {
    console.error('Error fetching products with Drizzle:', error);
    return { success: false, error: error.message, products: [], total: 0 };
  }
}
