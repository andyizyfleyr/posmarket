/**
 * Utilities — copy from web project (src/utils.ts + src/utils/slug.ts).
 */

import type { CartItem, Product, WholesaleTier } from '@/types';
import { totalVariantStock } from '@/utils/variants';

const compactNumber = (value: number, suffix: string): string => {
  const rounded = Number(value.toFixed(1));
  return `${rounded.toString().replace('.', ',')}${suffix}`;
};

export const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1_000_000_000) return compactNumber(num / 1_000_000_000, 'B');
  if (num >= 1_000_000) return compactNumber(num / 1_000_000, 'M');
  if (num >= 1_000) return compactNumber(num / 1_000, 'K');
  return num.toString();
};

/** Note affichée à la française : 4,8 (et non 4.8). */
export const formatRating = (rating: number): string =>
  (Number.isFinite(rating) ? rating : 0).toFixed(1).replace('.', ',');

/** Nombre de colonnes produit selon la largeur de l'écran. */
export function productColumnsForWidth(width: number): 2 | 3 | 4 {
  if (width >= 1_000) return 4;
  if (width >= 640) return 3;
  return 2;
}

/**
 * Stock réellement disponible : somme des variantes actives quand le produit
 * en a, sinon stock de base. Évite d'afficher « en stock » alors que toutes
 * les variantes sont épuisées.
 */
export function effectiveProductStock(product: Product): number {
  const variantStock = totalVariantStock(product.variants);
  if (variantStock !== null) return Math.max(0, variantStock);
  return Math.max(0, Number(product.stock) || 0);
}

export function productDiscountPercent(product: Product): number {
  const price = Number(product.price) || 0;
  const original = Number(product.originalPrice) || 0;
  if (original <= 0 || price <= 0 || original <= price) return 0;
  return Math.round(((original - price) / original) * 100);
}

/**
 * Fourchette de prix des variantes actives. Sert à afficher « dès X FCFA »
 * sur la carte quand les options changent le prix.
 */
export function variantPriceRange(
  product: Product,
): { min: number; max: number } | null {
  const prices = (product.variants || [])
    .filter((variant) => variant.enabled !== false)
    .map((variant) => Number(variant.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/**
 * Produit affichable en vitrine : image, prix valide et au moins une unité
 * disponible. Les fiches à 0 FCFA sans variante tarifée sont écartées de
 * l'accueil (elles restent accessibles via la recherche).
 */
export function isMarketableProduct(product: Product): boolean {
  const basePrice = Number(product.price) || 0;
  const displayPrice = variantPriceRange(product)?.min ?? basePrice;
  return (
    Boolean(product.image) &&
    effectiveProductStock(product) > 0 &&
    displayPrice > 0
  );
}

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

/** Jours restants avant une échéance (arrondi supérieur, minimum 0). */
export const getDaysRemaining = (end: string): number => {
  const endDate = new Date(end);
  const now = new Date();
  const diffTime = endDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
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
 * Calcule le prix total du lot pour un palier de gros
 * (ex: 400 000 FCFA pour le lot de 100 pièces).
 */
export function getTierPackagePrice(tier: WholesaleTier | undefined, productPrice: number): number {
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
 * Liste normalisée des paliers de gros triés par quantité croissante
 * (copie fidèle de src/utils/wholesale.ts du web).
 */
export function getNormalizedWholesaleTiers(product: Product): Array<{
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

  const basePrice = Number(product.price) || 0;
  const sorted = [...tiers].sort((a, b) => a.minQty - b.minQty);

  return sorted.map((t) => {
    const minQty = Math.max(1, Number(t.minQty) || 1);
    const unitPrice = getTierUnitPrice(t, basePrice);
    const packagePrice = getTierPackagePrice(t, basePrice);
    const normalTotal = basePrice * minQty;
    const savings = Math.max(0, normalTotal - packagePrice);
    const discountPct = normalTotal > 0 && savings > 0 ? Math.round((savings / normalTotal) * 100) : 0;

    return { minQty, packagePrice, unitPrice, savings, discountPct };
  });
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
