/**
 * Partie serveur du téléchargement groupé des images produits.
 *
 * Regroupe le contrôle d'accès, les lectures SQL et l'itération par lots des
 * produits (les data URI peuvent peser plusieurs mégaoctets : les charger tous
 * d'un coup ferait exploser la mémoire de la fonction).
 *
 * Ce module ne doit jamais être importé par un composant client.
 */

import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { products, stores } from '@/db/schema';
import { requireStoreAccess } from '@/lib/authorization';
import { resolveMobileStoreId } from '@/lib/mobile-space';
import {
  collectProductImageSlots,
  type ProductImageSlot,
  IMAGE_EXPORT_LIMITS,
} from '@/lib/product-images';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ImagesTarget =
  | {
      ok: true;
      storeId: string;
      storeName: string;
      /** `undefined` = tout le catalogue, sinon la sélection demandée. */
      productIds?: string[];
    }
  | { ok: false; status: number; error: string };

/**
 * Valide la liste d'identifiants produits passée en query string
 * (`ids=a,b,c`). Renvoie `null` si la liste est invalide.
 */
export function parseProductIds(raw: string | undefined): string[] | undefined | null {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  const ids = Array.from(
    new Set(
      trimmed
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
  if (ids.length === 0 || ids.length > IMAGE_EXPORT_LIMITS.maxSelectedProducts) {
    return null;
  }
  if (ids.some((id) => !UUID_RE.test(id))) return null;
  return ids;
}

/**
 * Boutique ciblée + autorisation + identifiants produits validés.
 * Le vendeur ne peut exporter que ses propres boutiques (ou celles de son
 * équipe, ou n'importe laquelle s'il est super administrateur).
 */
export async function resolveImagesTarget(
  userId: string,
  query: { storeId?: string; ids?: string },
): Promise<ImagesTarget> {
  const storeId = await resolveMobileStoreId(userId, query.storeId);
  if (!storeId) return { ok: false, status: 404, error: 'NoStore' };

  const access = await requireStoreAccess(storeId);
  if (!access.ok) return { ok: false, status: 403, error: access.error };

  const [store] = await db
    .select({ name: stores.name })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1);
  if (!store) return { ok: false, status: 404, error: 'Boutique introuvable' };

  const productIds = parseProductIds(query.ids);
  if (productIds === null) {
    return { ok: false, status: 400, error: 'Sélection de produits invalide.' };
  }

  return { ok: true, storeId, storeName: store.name, productIds };
}

function productFilter(storeId: string, productIds?: string[]) {
  return productIds && productIds.length > 0
    ? and(eq(products.storeId, storeId), inArray(products.id, productIds))
    : eq(products.storeId, storeId);
}

/* Fragments SQL réutilisés : nombre d'images principales / galerie / variantes. */

const MAIN_IMAGE_COUNT = sql<number>`CASE
  WHEN ${products.image} IS NULL OR btrim(${products.image}) = '' THEN 0 ELSE 1 END`;

const GALLERY_IMAGE_COUNT = sql<number>`COALESCE((
  SELECT count(*)::int
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(${products.images}) = 'array'
      THEN ${products.images} ELSE '[]'::jsonb END
  ) AS gallery(value)
  WHERE jsonb_typeof(gallery.value) = 'string'
    AND btrim(COALESCE(gallery.value #>> '{}', '')) <> ''
), 0)`;

const VARIANT_IMAGE_COUNT = sql<number>`COALESCE((
  SELECT count(*)::int
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(${products.variants}) = 'array'
      THEN ${products.variants} ELSE '[]'::jsonb END
  ) AS variant(item)
  WHERE btrim(COALESCE(variant.item->>'image', '')) <> ''
), 0)`;

export interface ProductImagesSummary {
  productCount: number;
  productsWithImages: number;
  productsWithoutImages: number;
  imageCount: number;
}

/**
 * Compteurs affichés dans la modale avant téléchargement.
 * Les images de variantes sont incluses ; les doublons internes à un produit
 * (image principale reprise dans la galerie) peuvent gonfler légèrement le
 * total, ce qui n'a aucune incidence sur l'archive elle-même.
 */
export async function getStoreProductImagesSummary(
  storeId: string,
  productIds?: string[],
): Promise<ProductImagesSummary> {
  const rows = await db
    .select({
      main: MAIN_IMAGE_COUNT,
      gallery: GALLERY_IMAGE_COUNT,
      variants: VARIANT_IMAGE_COUNT,
    })
    .from(products)
    .where(productFilter(storeId, productIds));

  let imageCount = 0;
  let productsWithImages = 0;
  for (const row of rows) {
    const count = Number(row.main) + Number(row.gallery) + Number(row.variants);
    if (count > 0) {
      productsWithImages += 1;
      imageCount += count;
    }
  }

  return {
    productCount: rows.length,
    productsWithImages,
    productsWithoutImages: rows.length - productsWithImages,
    imageCount,
  };
}

/** Vrai dès qu'un produit de la sélection possède au moins une image. */
export async function storeHasProductImages(
  storeId: string,
  productIds?: string[],
): Promise<boolean> {
  const [row] = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        productFilter(storeId, productIds),
        sql`(
          (${products.image} IS NOT NULL AND btrim(${products.image}) <> '')
          OR (
            CASE WHEN jsonb_typeof(${products.images}) = 'array'
              THEN jsonb_array_length(${products.images}) ELSE 0 END
          ) > 0
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE WHEN jsonb_typeof(${products.variants}) = 'array'
                THEN ${products.variants} ELSE '[]'::jsonb END
            ) AS variant(item)
            WHERE btrim(COALESCE(variant.item->>'image', '')) <> ''
          )
        )`,
      ),
    )
    .limit(1);
  return Boolean(row);
}

export interface ProductImageFolder {
  productId: string;
  productName: string;
  /** Position 1-based dans le catalogue (préfixe du dossier). */
  productIndex: number;
  slots: ProductImageSlot[];
}

/**
 * Parcourt les produits par lots et renvoie, pour chacun, ses images
 * dédoublonnées. L'ordre est stable (date de création puis identifiant), ce qui
 * rend le nommage des dossiers reproductible d'un export à l'autre.
 */
export async function* iterateStoreProductImageFolders(
  storeId: string,
  productIds?: string[],
): AsyncGenerator<ProductImageFolder> {
  const where = productFilter(storeId, productIds);
  const pageSize = IMAGE_EXPORT_LIMITS.productsPerQuery;
  let offset = 0;
  let productIndex = 0;

  for (;;) {
    const rows = await db
      .select({
        id: products.id,
        name: products.name,
        image: products.image,
        images: products.images,
        variants: products.variants,
      })
      .from(products)
      .where(where)
      .orderBy(asc(products.createdAt), asc(products.id))
      .limit(pageSize)
      .offset(offset);

    if (rows.length === 0) break;

    for (const row of rows) {
      productIndex += 1;
      const slots = collectProductImageSlots({
        id: row.id,
        name: row.name,
        image: row.image,
        images: row.images,
        variants: row.variants,
      });
      if (slots.length === 0) continue;
      yield {
        productId: row.id,
        productName: row.name,
        productIndex,
        slots,
      };
    }

    offset += rows.length;
    if (rows.length < pageSize) break;
  }
}
