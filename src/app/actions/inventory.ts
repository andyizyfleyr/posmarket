'use server'

import { updateTag } from 'next/cache'
import { uploadDataUriToR2 } from '@/lib/r2'
import { db } from '@/db'
import { products, profiles, stores, storeStaff } from '@/db/schema'
import { eq, and, sql, inArray, desc } from 'drizzle-orm'
import { createClient } from '@/utils/supabase/server'
import { normalizeOptions, normalizeVariants, buildVariantMatrix } from '@/utils/variants'

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
  options?: unknown;
  variants?: unknown;
};

/**
 * Un produit n'est modifiable que par le propriétaire de la boutique ou par un
 * membre de son équipe. Sans ce contrôle, n'importe quel vendeur authentifié
 * pouvait altérer ou supprimer les produits d'un concurrent.
 */
async function requireStoreAccess(storeId: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Non authentifié' };
  if (!storeId) return { ok: false, error: 'Boutique inconnue' };

  const [owned] = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.id, storeId), eq(stores.userId, user.id)))
    .limit(1);
  if (owned) return { ok: true, userId: user.id };

  const [staff] = await db
    .select({ id: storeStaff.id })
    .from(storeStaff)
    .where(and(eq(storeStaff.storeId, storeId), eq(storeStaff.userId, user.id)))
    .limit(1);
  if (staff) return { ok: true, userId: user.id };

  return { ok: false, error: "Vous n'avez pas accès à cette boutique" };
}

export async function saveProductAction(product: ProductInput, storeId: string) {
  try {
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { success: false, error: access.error };

    // 1. Check Limits for NEW products
    if (!product.id) {
      const [profile] = await db.select().from(profiles).where(eq(profiles.id, access.userId)).limit(1);
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

    const name = String(product.name || '').trim();
    if (!name) return { success: false, error: 'Le nom du produit est obligatoire.' };
    if (name.length > 140) return { success: false, error: 'Le nom ne doit pas dépasser 140 caractères.' };

    const price = Number(product.price);
    if (!Number.isFinite(price) || price < 0) {
      return { success: false, error: 'Le prix doit être un nombre positif.' };
    }

    if (Number(product.stock) < 0) return { success: false, error: 'Le stock ne peut pas être négatif.' };;

    // --- Variantes : cohérence serveur, sans jamais écraser la saisie ---
    const warnings: string[] = [];
    const options = normalizeOptions(product.options);
    const rawVariants = Array.isArray(product.variants) ? product.variants : [];
    // `normalizeVariants` filtre les entrées illisibles SANS prévenir : on
    // mesure d'abord la perte réelle, sinon les avertissements seraient
    // toujours vides et l'appelant croirait la matrice intacte.
    const keptVariants = normalizeVariants(rawVariants, options);
    const droppedByNormalization = rawVariants.length - keptVariants.length;
    if (droppedByNormalization > 0) {
      warnings.push(
        `${droppedByNormalization} variante(s) illisible(s) ou hors matrice ont été écartées.`
      );
    }
    const { variants, dropped } = buildVariantMatrix(options, keptVariants, price);
    if (dropped.length > 0) {
      warnings.push(
        `${dropped.length} variante(s) retirée(s) : leurs options ne font plus partie du produit.`
      );
    }
    // Le stock global doit refléter la matrice : c'est lui qui pilote les
    // listes, les compteurs et le fallback « produit sans variante ».
    const stockValue = options.length > 0
      ? variants.reduce((total, variant) => total + Math.max(0, Math.round(Number(variant.stock) || 0)), 0)
      : Math.max(0, Math.round(Number(product.stock) || 0));

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
      name,
      price: String(price),
      originalPrice: (product.originalPrice || product.original_price)?.toString(),
      category: product.category,
      image: imageValue,
      images: imagesValue,
      unit: product.unit || null,
      deliveryTime: product.deliveryTime || null,
      preparationTime: product.preparationTime || null,
      stock: stockValue,
      mainCategory: product.mainCategory || product.main_category,
      description: product.description,
      isOnline: product.isOnline !== undefined ? product.isOnline : true,
      wholesalePrice: product.wholesalePrice?.toString(),
      wholesaleMinQty: product.wholesaleMinQty,
      wholesaleTiers: product.wholesaleTiers || [],
      businessType: product.businessType || 'shopping',
      options,
      variants
    };

    let savedProduct;
    if (product.id && !product.id.startsWith('temp-')) {
      // Le filtre boutique est indissociable de l'id : sans lui, un vendeur
      // pouvait réécrire le produit d'un concurrent.
      [savedProduct] = await db
        .update(products)
        .set(dataToSave)
        .where(and(eq(products.id, product.id), eq(products.storeId, storeId)))
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

    return { success: true, product: safe, warnings };
  } catch (error: unknown) {
    console.error('Error saving product with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function deleteProductAction(id: string, storeId: string) {
  try {
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { success: false, error: access.error };
    if (!id) return { success: false, error: 'Produit introuvable' };

    const deleted = await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.storeId, storeId)))
      .returning({ id: products.id });
    if (deleted.length === 0) return { success: false, error: 'Produit introuvable' };

    updateTag('marketplace');
    return { success: true };
  } catch (error: unknown) {
    console.error('Error deleting product with Drizzle:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function bulkDeleteProductsAction(ids: string[], storeId: string) {
  try {
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { success: false, error: access.error };

    const targets = (ids || []).filter((id) => typeof id === 'string' && id.length > 0);
    if (targets.length === 0) return { success: false, error: 'Aucun produit sélectionné' };

    // Le filtre boutique empêche de supprimer les produits d'un autre vendeur
    // en y glissant des identifiants.
    const deleted = await db
      .delete(products)
      .where(and(inArray(products.id, targets), eq(products.storeId, storeId)))
      .returning({ id: products.id });
    if (deleted.length === 0) return { success: false, error: 'Aucun produit supprimable' };

    updateTag('marketplace');
    return { success: true, deleted: deleted.length };
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
      products: (productsList || []).map((p) => {
        // Nettoyage à la lecture : d'anciennes fiches stockaient des objets
        // `{}` ou des variantes orphelines, l'éditeurvendeur ne doit jamais les
        // récupérer tels quels.
        const options = normalizeOptions(p.options);
        return {
          ...p,
          price: parseFloat(p.price ?? '') || 0,
          originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : undefined,
          isOnline: p.isOnline !== false,
          wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : undefined,
          wholesaleMinQty: p.wholesaleMinQty,
          mainCategory: p.mainCategory,
          businessType: p.businessType,
          options,
          variants: options.length > 0 ? normalizeVariants(p.variants, options) : []
        };
      }),
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
