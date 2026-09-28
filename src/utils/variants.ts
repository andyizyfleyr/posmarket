/**
 * Utilitaires de variantes produits.
 *
 * Les options et les variantes sont stockées en JSONB sur `products`
 * (`products.options` / `products.variants`). Ces fonctions sont la seule
 * source de vérité pour :
 *  - la matrice des combinaisons (génération NON destructive) ;
 *  - la normalisation des données avant écriture en base ;
 *  - la comparaison de deux combinaisons côté acheteur.
 *
 * Elles sont volontairement pures et sans dépendance React afin d'être
 * utilisées indifféremment par le formulaire vendeur et par les server actions.
 */

export type ProductOptionDef = {
  id: string;
  name: string;
  values: string[];
};

export type ProductVariantDef = {
  id: string;
  name: string;
  optionValues: Record<string, string>;
  price: number;
  stock: number;
  sku?: string;
  image?: string;
};

export const MAX_VARIANT_OPTIONS = 3;
export const MAX_VALUES_PER_OPTION = 20;
export const MAX_VARIANTS = 200;

/** Identifiant durable : survit aux rechargements de la fiche produit. */
export function newVariantId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value: unknown, max = 80): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Nettoie les options issues du client ou de la base.
 * Une option sans nom ou sans valeur est ignorée : elle ne peut pas
 * produire de variante exploitable.
 */
export function normalizeOptions(raw: unknown): ProductOptionDef[] {
  if (!Array.isArray(raw)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: ProductOptionDef[] = [];

  for (const entry of raw.slice(0, MAX_VARIANT_OPTIONS)) {
    if (!entry || typeof entry !== 'object') continue;
    const option = entry as Record<string, unknown>;
    const name = cleanText(option.name, 40);
    if (!name || seenNames.has(name.toLowerCase())) continue;

    const sourceValues = Array.isArray(option.values)
      ? option.values
      : typeof option.values === 'string'
        ? option.values.split(',')
        : [];
    const values: string[] = [];
    for (const value of sourceValues) {
      const cleaned = cleanText(value, 40);
      if (!cleaned) continue;
      if (values.some((v) => v.toLowerCase() === cleaned.toLowerCase())) continue;
      values.push(cleaned);
      if (values.length >= MAX_VALUES_PER_OPTION) break;
    }
    if (values.length === 0) continue;

    const rawId = cleanText(option.id, 64);
    const id = rawId && !seenIds.has(rawId) ? rawId : newVariantId();
    seenIds.add(id);
    seenNames.add(name.toLowerCase());
    out.push({ id, name, values });
  }

  return out;
}

/** Clé de combinaison stable, indépendante de l'ordre des clés. */
export function variantCombinationKey(optionValues: Record<string, string> | null | undefined): string {
  if (!optionValues || typeof optionValues !== 'object') return '';
  return Object.keys(optionValues)
    .sort()
    .map((key) => `${key}=>${String(optionValues[key] ?? '').trim().toLowerCase()}`)
    .join('|');
}

/** Libellé lisible d'une combinaison : « Rouge / M ». */
export function variantLabel(
  optionValues: Record<string, string>,
  options: ProductOptionDef[]
): string {
  return options
    .map((option) => optionValues?.[option.id])
    .filter((value): value is string => !!value)
    .join(' / ');
}

export function combinationsOf(options: ProductOptionDef[]): Record<string, string>[] {
  if (options.length === 0) return [];
  let combinations: Record<string, string>[] = [{}];
  for (const option of options) {
    const next: Record<string, string>[] = [];
    for (const combination of combinations) {
      for (const value of option.values) {
        next.push({ ...combination, [option.id]: value });
      }
    }
    combinations = next;
    if (combinations.length > MAX_VARIANTS) break;
  }
  return combinations.slice(0, MAX_VARIANTS);
}

/**
 * Génère la matrice des variantes SANS rien détruire.
 *
 * - une combinaison déjà saisie conserve son identifiant, son prix, son stock,
 *   son SKU et son image ;
 * - les nouvelles combinaisons héritent du prix du produit ;
 * - les variantes devenues invalides sont retournées dans `dropped` pour que
 *   l'interface puisse prévenir l'utilisateur au lieu de les effacer en silence.
 */
export function buildVariantMatrix(
  options: ProductOptionDef[],
  existing: ProductVariantDef[],
  fallbackPrice: number
): { variants: ProductVariantDef[]; dropped: ProductVariantDef[] } {
  const combinations = combinationsOf(options);
  const byKey = new Map<string, ProductVariantDef>();
  for (const variant of existing) {
    const key = variantCombinationKey(variant.optionValues);
    if (key && !byKey.has(key)) byKey.set(key, variant);
  }

  const price = toFiniteNumber(fallbackPrice, 0);
  const variants: ProductVariantDef[] = combinations.map((combination) => {
    const key = variantCombinationKey(combination);
    const previous = byKey.get(key);
    byKey.delete(key);
    return {
      id: previous?.id || newVariantId(),
      name: variantLabel(combination, options),
      optionValues: combination,
      price: previous ? toFiniteNumber(previous.price, price) : price,
      stock: previous ? Math.max(0, Math.round(toFiniteNumber(previous.stock, 0))) : 0,
      ...(previous?.sku ? { sku: previous.sku } : {}),
      ...(previous?.image ? { image: previous.image } : {}),
    };
  });

  return { variants, dropped: Array.from(byKey.values()) };
}

/**
 * Nettoie les variantes avant écriture : clés d'options valides, valeurs
 * autorisées par l'option correspondante, prix et stock coercés.
 */
export function normalizeVariants(raw: unknown, options: ProductOptionDef[]): ProductVariantDef[] {
  if (!Array.isArray(raw)) return [];
  if (options.length === 0) return [];

  const valid = new Set(combinationsOf(options).map((combination) => variantCombinationKey(combination)));
  const seen = new Set<string>();
  const out: ProductVariantDef[] = [];

  for (const entry of raw.slice(0, MAX_VARIANTS)) {
    if (!entry || typeof entry !== 'object') continue;
    const variant = entry as Record<string, unknown>;
    const optionValues: Record<string, string> = {};

    for (const option of options) {
      const value = cleanText((variant.optionValues as Record<string, unknown> | undefined)?.[option.id], 40);
      if (value && option.values.some((allowed) => allowed.toLowerCase() === value.toLowerCase())) {
        optionValues[option.id] = value;
      }
    }
    if (Object.keys(optionValues).length !== options.length) continue;

    const key = variantCombinationKey(optionValues);
    if (!valid.has(key) || seen.has(key)) continue;
    seen.add(key);

    const price = Math.max(0, toFiniteNumber(variant.price, 0));
    const stock = Math.max(0, Math.round(toFiniteNumber(variant.stock, 0)));
    const sku = cleanText(variant.sku, 60);
    const image = cleanText(variant.image, 2048);

    out.push({
      id: cleanText(variant.id, 64) || newVariantId(),
      name: variantLabel(optionValues, options),
      optionValues,
      price,
      stock,
      ...(sku ? { sku } : {}),
      ...(image ? { image } : {}),
    });
  }

  return out;
}

/** Retrouve la variante correspondant à une sélection d'options. */
export function findVariantByOptions<T extends { optionValues?: Record<string, string> }>(
  variants: T[] | undefined | null,
  selected: Record<string, string>
): T | undefined {
  if (!Array.isArray(variants) || variants.length === 0) return undefined;
  const key = variantCombinationKey(selected);
  if (!key) return undefined;
  return variants.find((variant) => variantCombinationKey(variant.optionValues) === key);
}

export function variantIsInStock(
  variant: { stock?: number | null } | null | undefined
): boolean {
  if (!variant) return false;
  return toFiniteNumber(variant.stock, 0) > 0;
}

/**
 * Une variante est-elle compatible avec une sélection partielle ?
 * Les options pas encore choisies sont ignorées : c'est ce qui permet
 * d'afficher « disponible / indisponible » sur une valeur avant que
 * l'acheteur ait terminé sa sélection.
 */
function isVariantCompatibleWith(
  variant: { optionValues?: Record<string, string> },
  selection: Record<string, string>
): boolean {
  const keys = Object.keys(selection);
  if (keys.length === 0) return true;
  return keys.every((key) => {
    const expected = String(selection[key] ?? '').trim().toLowerCase();
    const actual = String(variant?.optionValues?.[key] ?? '').trim().toLowerCase();
    return expected !== '' && expected === actual;
  });
}

/**
 * État d'une valeur d'option pour l'acheteur.
 *
 * - `exists`   : au moins une variante de la matrice correspond à la sélection ;
 * - `available`: au moins une de ces variantes a du stock.
 *
 * Un produit sans variantes gérées renvoie `exists/available = true` :
 * le vendeur n'a simplement pas de matrice à respecter.
 */
export function optionValueAvailability(
  variants: Array<{ stock?: number | null; optionValues?: Record<string, string> }> | undefined,
  selected: Record<string, string>,
  optionId: string,
  value: string
): { exists: boolean; available: boolean } {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { exists: true, available: true };
  }
  const candidate = { ...selected, [optionId]: value };
  const compatible = variants.filter((variant) =>
    isVariantCompatibleWith(variant, candidate)
  );
  return {
    exists: compatible.length > 0,
    available: compatible.some((variant) => variantIsInStock(variant)),
  };
}

/** Stock total disponible toutes variantes confondues. */
export function totalVariantStock(
  variants: Array<{ stock?: number | null }> | undefined
): number | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.reduce((total, variant) => total + toFiniteNumber(variant?.stock, 0), 0);
}

/** Stock disponible d'une variante, ou null si le produit n'en a pas. */
export function variantStock(
  product: { stock?: number | null; variants?: Array<{ id: string; stock?: number }> } | null | undefined,
  variantId?: string | null
): number | null {
  if (!product) return null;
  if (variantId && Array.isArray(product.variants) && product.variants.length > 0) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant) return Math.max(0, Math.round(toFiniteNumber(variant.stock, 0)));
  }
  return product.stock != null ? Math.max(0, Math.round(toFiniteNumber(product.stock, 0))) : null;
}
