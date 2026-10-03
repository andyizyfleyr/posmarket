'use server'

import { updateTag } from 'next/cache'
import { uploadDataUriToR2 } from '@/lib/r2'
import { db } from '@/db'
import { products, profiles, stores, storeStaff, categories, productCategories } from '@/db/schema'
import { eq, and, sql, inArray, desc } from 'drizzle-orm'
import { createClient } from '@/utils/supabase/server'
import { normalizeOptions, normalizeVariants, buildVariantMatrix } from '@/utils/variants'
import type { ProductImportItem } from '@/utils/product-import-export'

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
async function requireStoreAccess(storeId: string): Promise<{ ok: true; userId: string; isSuperAdmin?: boolean } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Non authentifié' };
  if (!storeId) return { ok: false, error: 'Boutique inconnue' };

  const [profile] = await db
    .select({ isSuperAdmin: profiles.isSuperAdmin })
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  if (profile?.isSuperAdmin) {
    return { ok: true, userId: user.id, isSuperAdmin: true };
  }

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

    // La verticale est une propriété de la BOUTIQUE, jamais du produit : on la
    // relit en base et on l'impose. Sans cela, un vendeur pouvait créer des
    // produits « shopping » dans une boutique resto (et l'inverse), et le
    // catalogue public affichait alors des plats dans un shop et des produits
    // dans un resto.
    const [storeRow] = await db
      .select({ businessType: stores.businessType })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    const storeVertical: 'shopping' | 'food' = storeRow?.businessType === 'food' ? 'food' : 'shopping';

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

    // La catégorie doit appartenir à la verticale de la boutique : sans ce
    // contrôle, un produit de resto pouvait être rangé dans une catégorie de
    // commerce et apparaître dans les sections d'un shop.
    const wantedCategories = [product.mainCategory, product.main_category, product.category]
      .map((c) => String(c || '').trim())
      .filter(Boolean);
    if (wantedCategories.length > 0) {
      const rows = await db
        .select({ name: productCategories.name, businessType: productCategories.businessType })
        .from(productCategories)
        .where(inArray(productCategories.name, [...new Set(wantedCategories)]));
      for (const row of rows) {
        if ((row.businessType === 'food' ? 'food' : 'shopping') !== storeVertical) {
          return {
            success: false,
            error:
              storeVertical === 'food'
                ? `La catégorie « ${row.name} » n'appartient pas à la restauration.`
                : `La catégorie « ${row.name} » n'appartient pas au commerce.`,
          };
        }
      }
    }

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
      businessType: storeVertical,
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
      const access = await requireStoreAccess(storeId);
      if (!access.ok) return { success: false, error: access.error };

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

    // Garde-fou : la liste d'une boutique ne montre que ses produits. Le type
    // vient de la boutique, pas du client.
    {
      const [storeRow] = await db
        .select({ businessType: stores.businessType })
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1);
      const storeVertical = storeRow?.businessType === 'food' ? 'food' : 'shopping';
      conditions.push(eq(products.businessType, storeVertical));
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
      const access = await requireStoreAccess(storeId);
      if (!access.ok) return { ok: false, error: access.error };

      const rows = await db.select({ id: products.id, stock: products.stock }).from(products).where(eq(products.storeId, storeId));
    const stock: Record<string, number> = {};
    for (const r of rows) stock[r.id] = Number(r.stock ?? 0);
    return { ok: true, stock };
  } catch (error: unknown) {
    console.error('Error fetching stock counts with Drizzle:', error);
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Récupère la liste des boutiques accessibles pour l'utilisateur courant
 * (Boutiques dont il est propriétaire ou membre du personnel avec droits d'inventaire).
 */
export async function getUserManageableStoresAction(): Promise<{
  success: boolean;
  stores?: Array<{ id: string; name: string; slug: string; businessType: string; isOwner: boolean }>;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Non authentifié' };

    const [profile] = await db
      .select({ isSuperAdmin: profiles.isSuperAdmin })
      .from(profiles)
      .where(eq(profiles.id, user.id))
      .limit(1);

    if (profile?.isSuperAdmin) {
      const allStores = await db.select().from(stores).orderBy(desc(stores.createdAt));
      return {
        success: true,
        stores: allStores.map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          businessType: s.businessType,
          isOwner: s.userId === user.id,
        })),
      };
    }

    const ownedStores = await db
      .select()
      .from(stores)
      .where(eq(stores.userId, user.id))
      .orderBy(desc(stores.createdAt));

    const staffStores = await db
      .select({
        id: stores.id,
        name: stores.name,
        slug: stores.slug,
        businessType: stores.businessType,
        userId: stores.userId,
      })
      .from(storeStaff)
      .innerJoin(stores, eq(storeStaff.storeId, stores.id))
      .where(eq(storeStaff.userId, user.id));

    const storeMap = new Map<string, { id: string; name: string; slug: string; businessType: string; isOwner: boolean }>();

    for (const s of ownedStores) {
      storeMap.set(s.id, {
        id: s.id,
        name: s.name,
        slug: s.slug,
        businessType: s.businessType,
        isOwner: true,
      });
    }

    for (const s of staffStores) {
      if (!storeMap.has(s.id)) {
        storeMap.set(s.id, {
          id: s.id,
          name: s.name,
          slug: s.slug,
          businessType: s.businessType,
          isOwner: false,
        });
      }
    }

    return { success: true, stores: Array.from(storeMap.values()) };
  } catch (error: unknown) {
    console.error('Error fetching user manageable stores:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Exporte l'ensemble des produits d'une boutique (avec toutes les métadonnées complètes)
 */
export async function exportStoreProductsAction(
  storeId: string,
  filterIds?: string[]
): Promise<{
  success: boolean;
  products?: ProductImportItem[];
  store?: { id: string; name: string; businessType: string };
  error?: string;
}> {
  try {
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { success: false, error: access.error };

    const [storeRow] = await db
      .select({ id: stores.id, name: stores.name, businessType: stores.businessType })
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);

    if (!storeRow) return { success: false, error: 'Boutique introuvable' };

    const conditions = [eq(products.storeId, storeId)];
    if (filterIds && filterIds.length > 0) {
      conditions.push(inArray(products.id, filterIds));
    }

    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.createdAt));

    const exportList: ProductImportItem[] = rows.map((p) => {
      const options = normalizeOptions(p.options);
      const variants = options.length > 0 ? normalizeVariants(p.variants, options) : [];
      const images = Array.isArray(p.images) ? (p.images as string[]) : p.image ? [p.image] : [];

      return {
        id: p.id,
        name: p.name,
        price: parseFloat(p.price ?? '') || 0,
        originalPrice: p.originalPrice ? parseFloat(p.originalPrice) : null,
        stock: Number(p.stock) || 0,
        category: p.category || 'Général',
        mainCategory: p.mainCategory || 'Divers',
        unit: p.unit || 'pièce',
        description: p.description || '',
        image: p.image || images[0] || '',
        images,
        isOnline: p.isOnline !== false,
        businessType: (p.businessType as 'shopping' | 'food') || 'shopping',
        deliveryTime: p.deliveryTime || '',
        preparationTime: p.preparationTime || '',
        wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : null,
        wholesaleMinQty: p.wholesaleMinQty || null,
        wholesaleTiers: Array.isArray(p.wholesaleTiers) ? (p.wholesaleTiers as Array<{ minQty: number; price: number }>) : [],
        options,
        variants,
      };
    });

    return {
      success: true,
      products: exportList,
      store: storeRow,
    };
  } catch (error: unknown) {
    console.error('Error exporting store products:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Importe par lot une liste de produits dans une boutique cible
 */
export async function importProductsBatchAction(
  targetStoreId: string,
  items: ProductImportItem[],
  options: {
    duplicateStrategy: 'skip' | 'update' | 'create_new';
    resetStock?: boolean;
    forceOnlineStatus?: 'keep' | 'online' | 'pos';
  } = { duplicateStrategy: 'skip' }
): Promise<{
  success: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
  errors: string[];
  error?: string;
}> {
  try {
    const access = await requireStoreAccess(targetStoreId);
    if (!access.ok) {
      return {
        success: false,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        totalProcessed: 0,
        errors: [access.error],
        error: access.error,
      };
    }

    if (!items || items.length === 0) {
      return {
        success: false,
        createdCount: 0,
        updatedCount: 0,
        skippedCount: 0,
        totalProcessed: 0,
        errors: ['Aucun produit à importer'],
        error: 'Aucun produit à importer',
      };
    }

    // 1. Vérification des quotas d'abonnement
    const [targetStore] = await db.select().from(stores).where(eq(stores.id, targetStoreId)).limit(1);
    if (!targetStore) return { success: false, createdCount: 0, updatedCount: 0, skippedCount: 0, totalProcessed: 0, errors: ['Boutique introuvable'], error: 'Boutique introuvable' };

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, targetStore.userId)).limit(1);
    const [{ count: currentCountRaw }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(eq(products.storeId, targetStoreId));

    const currentCount = Number(currentCountRaw) || 0;
    const tier = profile?.subscriptionTier;
    const limit = tier === 'STARTER' ? 50 : tier === 'PRO' ? 500 : tier === 'ENTERPRISE' ? 999999 : 50;

    // 2. Pré-chargement du cache des catégories existantes pour la boutique cible
    const existingCategories = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, targetStoreId));

    const categoryMap = new Map<string, string>();
    for (const c of existingCategories) {
      categoryMap.set(c.name.trim().toLowerCase(), c.id);
    }

    // 3. Pré-chargement des produits existants pour détection des doublons
    const existingProducts = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(eq(products.storeId, targetStoreId));

    const productMap = new Map<string, string>();
    for (const p of existingProducts) {
      productMap.set(p.name.trim().toLowerCase(), p.id);
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const itemErrors: string[] = [];

    // Helper pour créer ou récupérer une catégorie
    const resolveCategoryId = async (catName: string): Promise<string | null> => {
      const trimmed = catName.trim();
      if (!trimmed) return null;
      const lower = trimmed.toLowerCase();
      if (categoryMap.has(lower)) {
        return categoryMap.get(lower)!;
      }
      try {
        const [inserted] = await db
          .insert(categories)
          .values({
            storeId: targetStoreId,
            name: trimmed,
          })
          .returning({ id: categories.id });
        if (inserted) {
          categoryMap.set(lower, inserted.id);
          return inserted.id;
        }
      } catch {
        // Ignorer si déjà inséré en concurrence
      }
      return null;
    };

    for (const item of items) {
      try {
        const name = String(item.name || '').trim();
        if (!name) {
          itemErrors.push(`Ligne ignorée : nom manquant.`);
          continue;
        }

        const price = Number(item.price);
        if (!Number.isFinite(price) || price < 0) {
          itemErrors.push(`Produit "${name}" ignoré : prix invalide (${item.price}).`);
          continue;
        }

        const lowerName = name.toLowerCase();
        const existingId = productMap.get(lowerName);

        if (existingId && options.duplicateStrategy === 'skip') {
          skippedCount++;
          continue;
        }

        // Vérification de limite avant chaque nouvelle création
        if (!existingId || options.duplicateStrategy === 'create_new') {
          if (currentCount + createdCount >= limit) {
            itemErrors.push(`Limite de ${limit} produits atteinte pour votre abonnement ${tier || 'STARTER'}. Certains produits n'ont pas pu être créés.`);
            break;
          }
        }

        // Variantes & options
        const normalizedOpts = normalizeOptions(item.options);
        let normalizedVars = normalizedOpts.length > 0 ? normalizeVariants(item.variants, normalizedOpts) : [];
        const { variants } = buildVariantMatrix(normalizedOpts, normalizedVars, price);
        normalizedVars = variants;

        // Stock handling
        let stockValue = options.resetStock
          ? 0
          : normalizedOpts.length > 0
            ? normalizedVars.reduce((total, v) => total + Math.max(0, Math.round(Number(v.stock) || 0)), 0)
            : Math.max(0, Math.round(Number(item.stock) || 0));

        if (options.resetStock && normalizedVars.length > 0) {
          normalizedVars = normalizedVars.map((v) => ({ ...v, stock: 0 }));
          stockValue = 0;
        }

        // Visibilité en ligne
        let isOnline = item.isOnline !== false;
        if (options.forceOnlineStatus === 'online') isOnline = true;
        if (options.forceOnlineStatus === 'pos') isOnline = false;

        // Catégorie
        const categoryName = item.category || 'Général';
        const categoryId = await resolveCategoryId(categoryName);

        // Images
        const imagesList = Array.isArray(item.images) && item.images.length > 0
          ? item.images
          : item.image
            ? [item.image]
            : [];
        const mainImage = item.image || imagesList[0] || null;

        const dataToSave = {
          storeId: targetStoreId,
          categoryId,
          category: categoryName,
          mainCategory: item.mainCategory || 'Divers',
          name,
          description: item.description || null,
          price: String(price),
          originalPrice: item.originalPrice ? String(item.originalPrice) : null,
          stock: stockValue,
          image: mainImage,
          images: imagesList,
          unit: item.unit || 'pièce',
          deliveryTime: item.deliveryTime || null,
          preparationTime: item.preparationTime || null,
          isOnline,
          wholesalePrice: item.wholesalePrice ? String(item.wholesalePrice) : null,
          wholesaleMinQty: item.wholesaleMinQty || null,
          wholesaleTiers: item.wholesaleTiers || [],
          businessType: targetStore.businessType === 'food' ? 'food' : 'shopping',
          options: normalizedOpts,
          variants: normalizedVars,
        };

        if (existingId && options.duplicateStrategy === 'update') {
          await db
            .update(products)
            .set(dataToSave)
            .where(and(eq(products.id, existingId), eq(products.storeId, targetStoreId)));
          updatedCount++;
        } else {
          const [inserted] = await db.insert(products).values(dataToSave).returning({ id: products.id });
          if (inserted) {
            productMap.set(lowerName, inserted.id);
            createdCount++;
          }
        }
      } catch (err: unknown) {
        itemErrors.push(`Erreur sur "${item.name}": ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    updateTag('marketplace');

    return {
      success: true,
      createdCount,
      updatedCount,
      skippedCount,
      totalProcessed: createdCount + updatedCount + skippedCount,
      errors: itemErrors,
    };
  } catch (error: unknown) {
    console.error('Error importing products batch:', error);
    return {
      success: false,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Transfère ou copie des produits d'une boutique source vers une boutique cible
 */
export async function transferProductsBetweenStoresAction(
  sourceStoreId: string,
  targetStoreId: string,
  productIds: string[],
  options: {
    duplicateStrategy: 'skip' | 'update' | 'create_new';
    copyStock: boolean;
    priceAdjustmentPercent?: number;
    priceAdjustmentFixed?: number;
    forceOnlineStatus?: 'keep' | 'online' | 'pos';
  }
): Promise<{
  success: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
  errors: string[];
  error?: string;
}> {
  try {
    // 1. Contrôle d'accès sur la source ET sur la cible
    const sourceAccess = await requireStoreAccess(sourceStoreId);
    if (!sourceAccess.ok) return { success: false, createdCount: 0, updatedCount: 0, skippedCount: 0, totalProcessed: 0, errors: [sourceAccess.error], error: sourceAccess.error };

    const targetAccess = await requireStoreAccess(targetStoreId);
    if (!targetAccess.ok) return { success: false, createdCount: 0, updatedCount: 0, skippedCount: 0, totalProcessed: 0, errors: [targetAccess.error], error: targetAccess.error };

    if (sourceStoreId === targetStoreId) {
      return { success: false, createdCount: 0, updatedCount: 0, skippedCount: 0, totalProcessed: 0, errors: ['La boutique source et la boutique cible doivent être différentes.'], error: 'La boutique source et la boutique cible doivent être différentes.' };
    }

    // Un transfert entre une boutique commerce et une boutique restauration
    // ferait apparaitre des plats dans un shop (et l'inverse). On le refuse.
    const [verticalRows] = await db
      .select({
        source: stores.businessType,
        target: sql<string>`(SELECT business_type FROM stores WHERE id = ${targetStoreId})`,
      })
      .from(stores)
      .where(eq(stores.id, sourceStoreId))
      .limit(1);
    const sourceVertical = verticalRows?.source === 'food' ? 'food' : 'shopping';
    const targetVertical = verticalRows?.target === 'food' ? 'food' : 'shopping';
    if (sourceVertical !== targetVertical) {
      const error = "Le transfert est impossible entre une boutique commerce et une boutique restauration.";
      return { success: false, createdCount: 0, updatedCount: 0, skippedCount: 0, totalProcessed: 0, errors: [error], error };
    }

    // 2. Récupérer les produits source
    const conditions = [eq(products.storeId, sourceStoreId)];
    if (productIds && productIds.length > 0) {
      conditions.push(inArray(products.id, productIds));
    }

    const sourceRows = await db
      .select()
      .from(products)
      .where(and(...conditions));

    if (sourceRows.length === 0) {
      return { success: false, createdCount: 0, updatedCount: 0, skippedCount: 0, totalProcessed: 0, errors: ['Aucun produit trouvé dans la boutique source.'], error: 'Aucun produit trouvé.' };
    }

    // 3. Adapter les prix et les stocks selon les options choisies
    const priceMultiplier = 1 + (Number(options.priceAdjustmentPercent) || 0) / 100;
    const priceFixed = Number(options.priceAdjustmentFixed) || 0;

    const itemsToImport: ProductImportItem[] = sourceRows.map((p) => {
      const origPrice = parseFloat(p.price ?? '') || 0;
      let newPrice = origPrice;
      if (options.priceAdjustmentPercent !== undefined || options.priceAdjustmentFixed !== undefined) {
        newPrice = Math.max(0, Math.round(origPrice * priceMultiplier + priceFixed));
      }

      let newOriginalPrice = p.originalPrice ? parseFloat(p.originalPrice) : null;
      if (newOriginalPrice !== null && (options.priceAdjustmentPercent !== undefined || options.priceAdjustmentFixed !== undefined)) {
        newOriginalPrice = Math.max(0, Math.round(newOriginalPrice * priceMultiplier + priceFixed));
      }

      const optionsList = normalizeOptions(p.options);
      let variantsList = optionsList.length > 0 ? normalizeVariants(p.variants, optionsList) : [];

      if (variantsList.length > 0) {
        variantsList = variantsList.map((v) => {
          let varPrice = v.price;
          if (options.priceAdjustmentPercent !== undefined || options.priceAdjustmentFixed !== undefined) {
            varPrice = Math.max(0, Math.round(v.price * priceMultiplier + priceFixed));
          }
          return {
            ...v,
            price: varPrice,
            stock: options.copyStock ? v.stock : 0,
          };
        });
      }

      const stock = options.copyStock ? Number(p.stock) || 0 : 0;
      const images = Array.isArray(p.images) ? (p.images as string[]) : p.image ? [p.image] : [];

      return {
        name: p.name,
        price: newPrice,
        originalPrice: newOriginalPrice,
        stock,
        category: p.category || 'Général',
        mainCategory: p.mainCategory || 'Divers',
        unit: p.unit || 'pièce',
        description: p.description || '',
        image: p.image || images[0] || '',
        images,
        isOnline: p.isOnline !== false,
        businessType: (p.businessType as 'shopping' | 'food') || 'shopping',
        deliveryTime: p.deliveryTime || '',
        preparationTime: p.preparationTime || '',
        wholesalePrice: p.wholesalePrice ? parseFloat(p.wholesalePrice) : null,
        wholesaleMinQty: p.wholesaleMinQty || null,
        wholesaleTiers: Array.isArray(p.wholesaleTiers) ? (p.wholesaleTiers as Array<{ minQty: number; price: number }>) : [],
        options: optionsList,
        variants: variantsList,
      };
    });

    // 4. Déléguer l'import par lot à `importProductsBatchAction`
    return await importProductsBatchAction(targetStoreId, itemsToImport, {
      duplicateStrategy: options.duplicateStrategy,
      resetStock: !options.copyStock,
      forceOnlineStatus: options.forceOnlineStatus,
    });
  } catch (error: unknown) {
    console.error('Error transferring products between stores:', error);
    return {
      success: false,
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      totalProcessed: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

