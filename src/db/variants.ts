import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index';
import { productVariants, productVariantSnapshots } from './schema';
import type { ProductOptionDef, ProductVariantDef } from '@/utils/variants';

type Db = typeof db;

/**
 * Empreinte de la matrice « options + variantes », hors stock courant.
 * Deux matrices sont considérées identiques si la structure (noms de variantes,
 * combinaisons, prix, sku, image, état) ne bouge pas — les variations de stock
 * seul ne doivent pas générer d'entrées d'historique (B3).
 */
export function variantMatrixSignature(
  options: ProductOptionDef[],
  variants: ProductVariantDef[]
): string {
  return JSON.stringify({
    options: options.map((o) => ({ id: o.id, name: o.name, values: o.values })),
    variants: variants.map((v) => ({
      name: v.name || '',
      optionValues: v.optionValues,
      price: Number(v.price) || 0,
      sku: v.sku || '',
      image: v.image || '',
      enabled: v.enabled !== false,
    })),
  });
}

/** Enregistre un instantané gelé de la matrice si elle a changé (B3). */
export async function freezeVariantSnapshot(
  dbc: Db,
  productId: string,
  options: ProductOptionDef[],
  variants: ProductVariantDef[],
  reason: string
) {
  const [last] = await dbc
    .select({ options: productVariantSnapshots.options, variants: productVariantSnapshots.variants })
    .from(productVariantSnapshots)
    .where(eq(productVariantSnapshots.productId, productId))
    .orderBy(desc(productVariantSnapshots.createdAt))
    .limit(1);

  const signature = variantMatrixSignature(options, variants);
  if (
    last &&
    variantMatrixSignature(
      (last.options || []) as ProductOptionDef[],
      (last.variants || []) as ProductVariantDef[]
    ) === signature
  ) {
    return;
  }
  await dbc.insert(productVariantSnapshots).values({
    productId,
    options: options as unknown as typeof productVariantSnapshots.$inferInsert.options,
    variants: variants as unknown as typeof productVariantSnapshots.$inferInsert.variants,
    reason,
  });
}

/**
 * Aligne la table relationnelle `product_variants` sur la matrice JSONB
 * (écriture produit : suppression + recréation, index = numéro de ligne).
 */
export async function syncProductVariants(
  dbc: Db,
  productId: string,
  options: ProductOptionDef[],
  variants: ProductVariantDef[],
  reason = 'update'
) {
  const dbc2 = dbc ?? db;
  await dbc2.delete(productVariants).where(eq(productVariants.productId, productId));
  if (variants.length > 0) {
    await dbc2.insert(productVariants).values(
      variants.map((v, i) => ({
        productId,
        name: v.name || null,
        optionValues: v.optionValues ?? {},
        price: String(Number(v.price) || 0),
        stock: Math.max(0, Math.round(Number(v.stock) || 0)),
        sku: v.sku || null,
        image: v.image || null,
        enabled: v.enabled !== false,
        sortOrder: i,
      }))
    );
  }
  await freezeVariantSnapshot(dbc2, productId, options, variants, reason);
}

/**
 * Reconstruit `product_variants` directement depuis le JSONB du produit.
 * Utilisé après un ajustement de stock (vente / restitution) : le stock des
 * lignes relationnelles doit rester fidèle au JSON vivant, sans créer
 * d'instantané d'historique (B3 réservé aux modifications de structure).
 */
export async function resyncVariantsFromJson(dbc: Db, productIds: string[]) {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return;
  const dbc2 = dbc ?? db;
  // Retirer les lignes puis les reconstruire depuis le JSONB : une seule
  // requête paramétrée, atomique.
  await dbc2.delete(productVariants).where(inArray(productVariants.productId, ids));
  await dbc2.execute(sql`
    INSERT INTO product_variants (product_id, name, option_values, price, stock, sku, image, enabled, sort_order)
    SELECT
      p.id,
      v->>'name',
      COALESCE(v->'optionValues', '{}'::jsonb),
      COALESCE((v->>'price')::numeric, 0),
      COALESCE((v->>'stock')::int, 0),
      v->>'sku',
      v->>'image',
      COALESCE((v->>'enabled')::boolean, true),
      row_number() OVER ()
    FROM products p,
         jsonb_array_elements(COALESCE(p.variants, '[]'::jsonb)) AS v
    WHERE p.id = ANY(${ids})
  `);
}