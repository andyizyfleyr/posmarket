/**
 * Utilities — copy from web project (src/utils.ts + src/utils/slug.ts).
 */

import type { CartItem, Product, WholesaleTier } from '@/types';

export const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1_000_000_000) {
    const value = num / 1_000_000_000;
    return value % 1 === 0 ? `${value}B` : `${value.toFixed(1).replace(/\.0$/, '')}B`;
  }
  if (num >= 1_000_000) {
    const value = num / 1_000_000;
    return value % 1 === 0 ? `${value}M` : `${value.toFixed(1).replace(/\.0$/, '')}M`;
  }
  if (num >= 1_000) {
    const value = num / 1_000;
    return value % 1 === 0 ? `${value}K` : `${value.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return num.toString();
};

export const formatCurrency = (amount: number): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0 FCFA';
  return Math.floor(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " FCFA";
};

export const maskName = (name?: string | null): string => {
  if (!name || !name.trim()) return 'Client vérifié';
  const parts = name.trim().split(/\s+/);
  return parts
    .map((part) => {
      if (part.length <= 1) return part + '***';
      return part[0] + '*'.repeat(Math.min(part.length - 1, 5));
    })
    .join(' ');
};

export const generateSlug = (text: string): string => {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-');
};

export function generateProductSlug(product: { id?: string; name?: string }): string {
  if (!product || !product.id) return '';
  if (!product.name) return product.id;
  const cleanName = product.name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const shortId = product.id.split('-')[0];
  if (!cleanName) return product.id;
  return `${cleanName}-${shortId}`;
}

// ── Tarifs de gros (copie fidèle de src/utils/wholesale.ts + getEffectiveItemPrice web) ──

/**
 * Calcule le prix unitaire effectif pour un palier de gros.
 * Si le vendeur a défini un prix de gros global pour le lot (ex: 400 000 FCFA pour 100 unités
 * alors que l'unité est à 5 000 FCFA), le prix unitaire calculé est 400 000 / 100 = 4 000 FCFA.
 * Si le prix était déjà unitaire (ex: 4 000 FCFA < 5 000 FCFA), il est conservé tel quel.
 */
export function getTierUnitPrice(tier: WholesaleTier | undefined, productPrice: number): number {
  if (!tier) return Number(productPrice) || 0;
  if (tier.unitPrice && tier.unitPrice > 0) return tier.unitPrice;

  const numPrice = Number(tier.price) || 0;
  const basePrice = Number(productPrice) || 0;
  const minQty = Math.max(1, Number(tier.minQty) || 1);

  if (numPrice <= 0) return basePrice;

  if (numPrice >= basePrice && minQty > 1) {
    return Math.round(numPrice / minQty);
  }

  return numPrice;
}

/**
 * Retourne le prix unitaire effectif à appliquer en fonction de la quantité commandée
 * (paliers de gros multiples ou ancien palier unique).
 */
export function getEffectiveWholesaleUnitPrice(
  product: Product,
  quantity: number,
  basePriceOverride?: number,
): number {
  const basePrice =
    basePriceOverride !== undefined ? basePriceOverride : Number(product.price) || 0;

  const tiers: WholesaleTier[] = [];
  if (Array.isArray(product.wholesaleTiers) && product.wholesaleTiers.length > 0) {
    tiers.push(...product.wholesaleTiers);
  } else if (product.wholesalePrice && product.wholesaleMinQty) {
    tiers.push({
      minQty: Number(product.wholesaleMinQty),
      price: Number(product.wholesalePrice),
    });
  }

  if (tiers.length === 0) return basePrice;

  // Palier le plus avantageux atteint par la quantité (tri décroissant par minQty).
  const sortedDesc = [...tiers].sort((a, b) => b.minQty - a.minQty);
  const matched = sortedDesc.find(
    (tier) => quantity >= Math.max(1, Number(tier.minQty) || 1),
  );

  return matched ? getTierUnitPrice(matched, basePrice) : basePrice;
}

/**
 * Prix unitaire effectif d'une ligne de panier :
 * prix de la variante choisie, puis palier de gros selon la quantité, sinon prix de base.
 */
export function getEffectiveItemPrice(
  item: Pick<CartItem, 'product' | 'quantity' | 'variantId'>,
): number {
  const { product, quantity, variantId } = item;

  let basePrice = Number(product.price) || 0;
  if (variantId && product.variants) {
    const variant = product.variants.find((v) => v.id === variantId);
    if (variant && Number.isFinite(Number(variant.price))) {
      basePrice = Number(variant.price);
    }
  }

  return getEffectiveWholesaleUnitPrice(product, quantity, basePrice);
}
