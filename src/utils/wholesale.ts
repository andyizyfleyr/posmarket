import { WholesaleTier, Product } from '@/types';

/**
 * Calcule le prix unitaire effectif pour un palier de gros.
 * Si le vendeur a défini un prix de gros global pour le lot (ex: 400 000 FCFA pour 100 unités alors que l'unité est à 5 000 FCFA),
 * le prix unitaire calculé est 400 000 / 100 = 4 000 FCFA.
 * Si le prix était déjà unitaire (ex: 4 000 FCFA < 5 000 FCFA), il est conservé tel quel.
 */
export function getTierUnitPrice(tier: WholesaleTier, productPrice: number): number {
  if (!tier) return Number(productPrice) || 0;
  if (tier.unitPrice && tier.unitPrice > 0) return tier.unitPrice;

  const numPrice = Number(tier.price) || 0;
  const basePrice = Number(productPrice) || 0;
  const minQty = Math.max(1, Number(tier.minQty) || 1);

  if (numPrice <= 0) return basePrice;

  // Si le prix de gros est supérieur ou égal au prix unitaire normal pour minQty > 1,
  // il s'agit du montant total du lot (ex: 400 000 FCFA dès 100 unités pour un article à 5 000 FCFA)
  if (numPrice >= basePrice && minQty > 1) {
    return Math.round(numPrice / minQty);
  }

  // Sinon, c'est déjà un prix unitaire réduit
  return numPrice;
}

/**
 * Calcule le prix total du lot pour un palier de gros.
 * (ex: 400 000 FCFA pour le lot de 100 pièces)
 */
export function getTierPackagePrice(tier: WholesaleTier, productPrice: number): number {
  if (!tier) return 0;
  const numPrice = Number(tier.price) || 0;
  const basePrice = Number(productPrice) || 0;
  const minQty = Math.max(1, Number(tier.minQty) || 1);

  if (numPrice <= 0) return basePrice * minQty;

  if (numPrice >= basePrice && minQty > 1) {
    return numPrice;
  }

  return Math.round(numPrice * minQty);
}

/**
 * Retourne la liste normalisée des paliers de gros triés par quantité croissante.
 */
export function getNormalizedWholesaleTiers(product: Product): Array<{
  minQty: number;
  packagePrice: number;
  unitPrice: number;
  savings: number;
  discountPct: number;
}> {
  const tiers: WholesaleTier[] = [];
  if (product.wholesaleTiers && product.wholesaleTiers.length > 0) {
    tiers.push(...product.wholesaleTiers);
  } else if (product.wholesalePrice && product.wholesaleMinQty) {
    tiers.push({ minQty: Number(product.wholesaleMinQty), price: Number(product.wholesalePrice) });
  }

  if (tiers.length === 0) return [];

  const basePrice = Number(product.price) || 0;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  return sorted.map(t => {
    const minQty = Math.max(1, Number(t.minQty) || 1);
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
      discountPct
    };
  });
}

/**
 * Retourne le prix unitaire effectif à appliquer en fonction de la quantité commandée.
 */
export function getEffectiveWholesaleUnitPrice(product: Product, quantity: number, basePriceOverride?: number): number {
  const basePrice = basePriceOverride !== undefined ? basePriceOverride : Number(product.price) || 0;
  const normalized = getNormalizedWholesaleTiers(product);

  if (normalized.length === 0) return basePrice;

  // Trouver le palier le plus avantageux atteint par la quantité (tri décroissant par minQty)
  const sortedDesc = [...normalized].sort((a, b) => b.minQty - a.minQty);
  const matched = sortedDesc.find(t => quantity >= t.minQty);

  if (matched) {
    return matched.unitPrice;
  }

  return basePrice;
}
