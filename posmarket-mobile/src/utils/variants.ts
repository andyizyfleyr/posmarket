/**
 * Utilitaires de variantes produit — portage fidèle de src/utils/variants.ts (web).
 *
 * Les options et variantes sont stockées en JSONB sur `products`. Ces fonctions
 * sont pures (aucune dépendance React) et servent à la fiche produit mobile :
 * matrice de combinaisons, disponibilité par valeur d'option, stock total.
 */

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Clé de combinaison stable, indépendante de l'ordre des clés. */
export function variantCombinationKey(
  optionValues: Record<string, string> | null | undefined,
): string {
  if (!optionValues || typeof optionValues !== 'object') return '';
  return Object.keys(optionValues)
    .sort()
    .map((key) => `${key}=>${String(optionValues[key] ?? '').trim().toLowerCase()}`)
    .join('|');
}

/** Retrouve la variante correspondant à une sélection d'options. */
export function findVariantByOptions<T extends { optionValues?: Record<string, string> }>(
  variants: T[] | undefined | null,
  selected: Record<string, string>,
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
  variant: { stock?: number | null; enabled?: boolean } | null | undefined,
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
  selection: Record<string, string>,
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
 * Un produit sans variantes gérées renvoie `exists/available = true`.
 */
export function optionValueAvailability(
  variants:
    | Array<{ stock?: number | null; enabled?: boolean; optionValues?: Record<string, string> }>
    | undefined,
  selected: Record<string, string>,
  optionId: string,
  value: string,
): { exists: boolean; available: boolean } {
  if (!Array.isArray(variants) || variants.length === 0) {
    return { exists: true, available: true };
  }
  const candidate = { ...selected, [optionId]: value };
  const compatible = variants.filter((variant) => isVariantCompatibleWith(variant, candidate));
  return {
    exists: compatible.some((v) => v.enabled !== false),
    available: compatible.some((variant) => variantIsInStock(variant)),
  };
}

/** Stock total disponible toutes variantes confondues. */
export function totalVariantStock(
  variants: Array<{ stock?: number | null; enabled?: boolean }> | undefined,
): number | null {
  if (!Array.isArray(variants) || variants.length === 0) return null;
  return variants.reduce(
    (total, variant) => total + (variant.enabled === false ? 0 : toFiniteNumber(variant?.stock, 0)),
    0,
  );
}
