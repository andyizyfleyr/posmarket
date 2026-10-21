import { WholesaleTier, Product } from '@/types';

const roundMoney = (value: number): number =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/**
 * Calcule le prix unitaire effectif d'un palier de gros.
 *
 * Le vendeur peut saisir soit un prix total de lot, soit un prix unitaire.
 * La détection reste volontairement conservatrice : un prix supérieur ou égal
 * au prix de détail pour plusieurs unités est considéré comme un prix de lot.
 * Dans tous les cas le résultat est plafonné au prix de détail : un palier mal
 * configuré ne doit jamais faire payer plus cher que le prix normal.
 */
export function getTierUnitPrice(tier: WholesaleTier | undefined, productPrice: number): number {
  const basePrice = Math.max(0, Number(productPrice) || 0);
  if (!tier) return basePrice;

  const minQty = Math.max(1, Math.floor(Number(tier.minQty) || 1));
  const explicitUnit = Number(tier.unitPrice);
  let unitPrice: number;

  if (Number.isFinite(explicitUnit) && explicitUnit > 0) {
    unitPrice = explicitUnit;
  } else {
    const numPrice = Number(tier.price) || 0;
    if (numPrice <= 0) return basePrice;
    unitPrice = numPrice >= basePrice && minQty > 1 ? numPrice / minQty : numPrice;
  }

  if (!Number.isFinite(unitPrice) || unitPrice <= 0) return basePrice;
  return Math.min(basePrice, unitPrice);
}

/**
 * Calcule le prix total du lot pour un palier de gros.
 * Il est dérivé du prix unitaire pour rester exactement cohérent avec le panier
 * (au centime près), même lorsque le prix du lot n'est pas divisible par la
 * quantité.
 */
export function getTierPackagePrice(tier: WholesaleTier, productPrice: number): number {
  if (!tier) return 0;
  const minQty = Math.max(1, Math.floor(Number(tier.minQty) || 1));
  return roundMoney(getTierUnitPrice(tier, productPrice) * minQty);
}

/**
 * Retourne la liste normalisée des paliers de gros triés par quantité croissante.
 */
export function getNormalizedWholesaleTiers(
  product: Product,
  basePriceOverride?: number,
): Array<{
  minQty: number;
  packagePrice: number;
  unitPrice: number;
  savings: number;
  discountPct: number;
}> {
  const tiers: WholesaleTier[] = [];
  if (Array.isArray(product.wholesaleTiers) && product.wholesaleTiers.length > 0) {
    tiers.push(...product.wholesaleTiers);
  } else if (product.wholesalePrice && product.wholesaleMinQty) {
    tiers.push({ minQty: Number(product.wholesaleMinQty), price: Number(product.wholesalePrice) });
  }

  if (tiers.length === 0) return [];

  const basePrice = Math.max(
    0,
    Number(basePriceOverride !== undefined ? basePriceOverride : product.price) || 0,
  );
  const sorted = [...tiers].sort((a, b) => Number(a.minQty) - Number(b.minQty));

  return sorted.map((t) => {
    const minQty = Math.max(1, Math.floor(Number(t.minQty) || 1));
    const unitPrice = getTierUnitPrice(t, basePrice);
    const packagePrice = getTierPackagePrice(t, basePrice);
    const normalTotal = basePrice * minQty;
    const savings = Math.max(0, normalTotal - packagePrice);
    const discountPct = normalTotal > 0 && savings > 0 ? Math.round((savings / normalTotal) * 100) : 0;

    return {
      minQty,
      packagePrice,
      unitPrice,
      savings,
      discountPct,
    };
  });
}

/**
 * Retourne le prix unitaire effectif à appliquer en fonction de la quantité.
 *
 * On retient le meilleur prix unitaire parmi tous les paliers atteints, et non
 * simplement le palier ayant la plus grande quantité minimale. Cela évite
 * qu'un palier mal configuré fasse payer plus cher qu'un palier inférieur.
 */
export function getEffectiveWholesaleUnitPrice(
  product: Product,
  quantity: number,
  basePriceOverride?: number,
): number {
  const basePrice = Math.max(
    0,
    Number(basePriceOverride !== undefined ? basePriceOverride : product.price) || 0,
  );
  const normalized = getNormalizedWholesaleTiers(product, basePrice);

  if (normalized.length === 0) return basePrice;

  const safeQuantity = Math.max(0, Number(quantity) || 0);
  const matched = normalized.filter((tier) => safeQuantity >= tier.minQty);
  if (matched.length === 0) return basePrice;

  return Math.min(basePrice, ...matched.map((tier) => tier.unitPrice));
}

export type WholesaleTierSaveResult = {
  tiers: WholesaleTier[];
  error?: string;
};

/**
 * Valide et canonicalise les paliers avant écriture en base.
 *
 * - quantité minimale entière >= 2 ;
 * - prix strictement inférieur au prix de détail ;
 * - pas de doublon de quantité ;
 * - prix unitaire non croissant avec la quantité.
 */
export function normalizeWholesaleTiersForSave(
  raw: unknown,
  basePrice: number,
): WholesaleTierSaveResult {
  if (!Array.isArray(raw) || raw.length === 0) return { tiers: [] };

  const base = Number(basePrice);
  if (!Number.isFinite(base) || base <= 0) {
    return { tiers: [], error: 'Le prix de détail doit être supérieur à 0 avant de configurer le gros.' };
  }

  const parsed: Array<{ minQty: number; price: number; unitPrice: number }> = [];
  const seenQuantities = new Set<number>();

  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') {
      return { tiers: [], error: 'Un palier de gros est illisible.' };
    }
    const tier = entry as WholesaleTier;
    const minQty = Math.floor(Number(tier.minQty));
    if (!Number.isFinite(minQty) || minQty < 2) {
      return { tiers: [], error: 'Chaque palier doit avoir une quantité minimale d’au moins 2 unités.' };
    }
    if (seenQuantities.has(minQty)) {
      return { tiers: [], error: 'Deux paliers ne peuvent pas avoir la même quantité minimale.' };
    }
    seenQuantities.add(minQty);

    const price = Number(tier.price);
    if (!Number.isFinite(price) || price <= 0) {
      return { tiers: [], error: 'Le prix d’un palier de gros doit être supérieur à 0.' };
    }

    const explicitUnit = Number(tier.unitPrice);
    const unitPrice =
      Number.isFinite(explicitUnit) && explicitUnit > 0
        ? explicitUnit
        : price >= base && minQty > 1
          ? price / minQty
          : price;

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { tiers: [], error: 'Le prix unitaire d’un palier de gros est invalide.' };
    }
    if (unitPrice >= base) {
      return {
        tiers: [],
        error: `Le prix de gros doit être inférieur au prix de détail (${base} FCFA).`,
      };
    }

    parsed.push({ minQty, price, unitPrice });
  }

  parsed.sort((a, b) => a.minQty - b.minQty);
  for (let i = 1; i < parsed.length; i += 1) {
    if (parsed[i].unitPrice > parsed[i - 1].unitPrice + 0.005) {
      return {
        tiers: [],
        error: 'Les paliers de gros doivent être dégressifs : le prix unitaire ne peut pas augmenter avec la quantité.',
      };
    }
  }

  return {
    tiers: parsed.map((tier) => ({
      minQty: tier.minQty,
      price: roundMoney(tier.unitPrice * tier.minQty),
      unitPrice: tier.unitPrice,
    })),
  };
}
