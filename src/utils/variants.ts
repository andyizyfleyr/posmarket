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
  /** Nom modifié manuellement : il n'est plus recalculé à chaque reconstr. */
  nameCustom?: boolean;
  /** Variante conservée mais non vendable (masquée côté acheteur). */
  enabled?: boolean;
};

export type VariantLimits = {
  maxOptions: number;
  maxValuesPerOption: number;
  maxVariants: number;
};

/**
 * Bornes par défaut. Raisonnables en perf : la génération de combinaisons est
 * bornée par `maxVariants`, donc même avec le maximum d'options le produit
 * reste exploitable.
 */
export const DEFAULT_VARIANT_LIMITS: VariantLimits = {
  maxOptions: 4,
  maxValuesPerOption: 20,
  maxVariants: 500,
};

export const MAX_VARIANT_OPTIONS = DEFAULT_VARIANT_LIMITS.maxOptions;
export const MAX_VALUES_PER_OPTION = DEFAULT_VARIANT_LIMITS.maxValuesPerOption;
export const MAX_VARIANTS = DEFAULT_VARIANT_LIMITS.maxVariants;

/**
 * Active une surcharge boutique : les bornes sont plafonnées pour garder un
 * plafond de sécurité même si un appelleur fournit une valeur absurde.
 */
export function resolveVariantLimits(limits?: Partial<VariantLimits>): VariantLimits {
  const clamp = (v: unknown, fallback: number, min: number, max: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  };
  return {
    maxOptions: clamp(limits?.maxOptions, DEFAULT_VARIANT_LIMITS.maxOptions, 1, 6),
    maxValuesPerOption: clamp(
      limits?.maxValuesPerOption,
      DEFAULT_VARIANT_LIMITS.maxValuesPerOption,
      1,
      50,
    ),
    maxVariants: clamp(limits?.maxVariants, DEFAULT_VARIANT_LIMITS.maxVariants, 1, 2000),
  };
}

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
export function normalizeOptions(raw: unknown, limits?: Partial<VariantLimits>): ProductOptionDef[] {
  if (!Array.isArray(raw)) return [];
  const { maxOptions, maxValuesPerOption } = resolveVariantLimits(limits);
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const out: ProductOptionDef[] = [];

  for (const entry of raw.slice(0, maxOptions)) {
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
      if (values.length >= maxValuesPerOption) break;
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

export function combinationsOf(
  options: ProductOptionDef[],
  limits?: Partial<VariantLimits>,
): Record<string, string>[] {
  if (options.length === 0) return [];
  const { maxVariants } = resolveVariantLimits(limits);
  let combinations: Record<string, string>[] = [{}];
  for (const option of options) {
    const next: Record<string, string>[] = [];
    for (const combination of combinations) {
      for (const value of option.values) {
        next.push({ ...combination, [option.id]: value });
      }
    }
    combinations = next;
    if (combinations.length > maxVariants) break;
  }
  return combinations.slice(0, maxVariants);
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
  fallbackPrice: number,
  limits?: Partial<VariantLimits>
): { variants: ProductVariantDef[]; dropped: ProductVariantDef[] } {
  const combinations = combinationsOf(options, limits);
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
      // Un nom saisi à la main est conservé, sinon il suit les options.
      name: previous?.nameCustom ? previous.name : variantLabel(combination, options),
      optionValues: combination,
      price: previous ? toFiniteNumber(previous.price, price) : price,
      stock: previous ? Math.max(0, Math.round(toFiniteNumber(previous.stock, 0))) : 0,
      nameCustom: previous?.nameCustom === true,
      // Une variante désactivée le reste tant que sa combinaison existe.
      enabled: previous ? previous.enabled !== false : true,
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
export function normalizeVariants(
  raw: unknown,
  options: ProductOptionDef[],
  limits?: Partial<VariantLimits>
): ProductVariantDef[] {
  if (!Array.isArray(raw)) return [];
  if (options.length === 0) return [];

  const { maxVariants } = resolveVariantLimits(limits);
  const valid = new Set(combinationsOf(options, limits).map((combination) => variantCombinationKey(combination)));
  const seen = new Set<string>();
  const out: ProductVariantDef[] = [];

  for (const entry of raw.slice(0, maxVariants)) {
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

    const name = cleanText(variant.name, 120);
    const nameCustom = variant.nameCustom === true;
    const enabled = variant.enabled !== false;

    out.push({
      id: cleanText(variant.id, 64) || newVariantId(),
      name: nameCustom && name ? name : variantLabel(optionValues, options),
      nameCustom,
      optionValues,
      price,
      stock,
      enabled,
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
  return variants.find((variant) => {
    if ((variant as { enabled?: boolean }).enabled === false) return false;
    return variantCombinationKey(variant.optionValues) === key;
  });
}

export function variantIsInStock(
  variant: { stock?: number | null; enabled?: boolean } | null | undefined
): boolean {
  if (!variant) return false;
  if (variant.enabled === false) return false;
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
  variants: Array<{ stock?: number | null; enabled?: boolean; optionValues?: Record<string, string> }> | undefined,
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
    exists: compatible.some((v) => v.enabled !== false),
    available: compatible.some((variant) => variantIsInStock(variant)),
  };
}

/** Stock total disponible toutes variantes confondues. */
export function totalVariantStock(
  variants: Array<{ stock?: number | null; enabled?: boolean }> | undefined
): number | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.reduce(
    (total, variant) =>
      total + (variant.enabled === false ? 0 : toFiniteNumber(variant?.stock, 0)),
    0,
  );
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
