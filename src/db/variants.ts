import { desc, eq, inArray } from 'drizzle-orm';
import { productVariants, productVariantSnapshots, products } from './schema';
import { newVariantId, type ProductOptionDef, type ProductVariantDef } from '@/utils/variants';

type Db = typeof import('./index').db;

/**
 * Ligne relationnelle pour une variante JSONB.
 *
 * L'id doit être celui du JSONB (c'est lui que porte `order_items.variant_id`) :
 * un id dupliqué ou manquant casserait l'insert en clé primaire, d'où la garde.
 */
function toVariantRow(
  v: ProductVariantDef,
  i: number,
  productId: string,
  used: Set<string>
) {
  let id = v.id;
  while (!id || used.has(id)) id = newVariantId();
  used.add(id);
  return {
    id,
    productId,
    name: v.name || null,
    optionValues: v.optionValues ?? {},
    price: String(Number(v.price) || 0),
    stock: Math.max(0, Math.round(Number(v.stock) || 0)),
    sku: v.sku || null,
    image: v.image || null,
    enabled: v.enabled !== false,
    sortOrder: i,
  };
}

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
  await dbc.delete(productVariants).where(eq(productVariants.productId, productId));
  if (variants.length > 0) {
    const used = new Set<string>();
    await dbc.insert(productVariants).values(variants.map((v, i) => toVariantRow(v, i, productId, used)));
  }
  await freezeVariantSnapshot(dbc, productId, options, variants, reason);
}

/**
 * Reconstruit `product_variants` depuis le JSONB du produit.
 * Utilisé après un ajustement de stock (vente / restitution) : le stock des
 * lignes relationnelles doit rester fidèle au JSON vivant, sans créer
 * d'instantané d'historique (B3 réservé aux modifications de structure).
 *
 * Tout passe par drizzle : un tableau glissé dans du SQL brut arrive côté
 * Postgres comme un littéral JSON `["..."]` et casse le typage `uuid[]`.
 */
export async function resyncVariantsFromJson(dbc: Db, productIds: string[]) {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (ids.length === 0) return;
  const rows = await dbc
    .select({ id: products.id, variants: products.variants })
    .from(products)
    .where(inArray(products.id, ids));
  if (rows.length === 0) return;

  const values: (typeof productVariants.$inferInsert)[] = [];
  for (const row of rows) {
    const variants = (Array.isArray(row.variants) ? row.variants : []) as ProductVariantDef[];
    const used = new Set<string>();
    variants.forEach((v, i) => {
      values.push(toVariantRow(v, i, row.id, used));
    });
  }

  await dbc.delete(productVariants).where(inArray(productVariants.productId, ids));
  if (values.length > 0) await dbc.insert(productVariants).values(values);
}