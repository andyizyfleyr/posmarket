/**
 * Modification en masse de produits.
 *
 * Le vendeur sélectionne plusieurs produits dans l'inventaire puis applique un
 * même changement (prix, stock, catégorie, unité, canal de vente). Toute la
 * logique de calcul vit ici, sans dépendance React ni base : la modale cliente
 * affiche exactement le résultat que la server action écrira.
 *
 * Les opérations sont relatives quand c'est utile (« +10 % », « retirer 5 ») :
 * un prix unique imposé à tout un catalogue est rarement ce que le vendeur
 * veut, alors qu'une hausse uniforme l'est.
 */

import type { ProductVariantDef } from '@/utils/variants';

export type BulkPriceMode = 'set' | 'percent' | 'amount';
export type BulkStockMode = 'set' | 'add' | 'remove';

export type BulkProductPatch = {
  /** Nouveau prix : fixe, variation en pourcentage ou en montant. */
  price?: { mode: BulkPriceMode; value: number };
  /** Nouveau stock : fixe, ajout ou retrait. */
  stock?: { mode: BulkStockMode; value: number };
  /** Catégories à appliquer ; `undefined` laisse la valeur existante. */
  category?: { mainCategory?: string; category?: string };
  unit?: string;
  isOnline?: boolean;
};

/** Champs réellement modifiés, renvoyés au client pour mettre à jour sa liste. */
export type BulkProductUpdate = {
  id: string;
  price?: number;
  variants?: ProductVariantDef[];
  stock?: number;
  category?: string | null;
  mainCategory?: string | null;
  unit?: string | null;
  isOnline?: boolean;
};

export type BulkUpdateSummary = {
  /** Produits ayant reçu au moins une modification. */
  updated: number;
  /** Produits à variantes dont le stock global n'a pas été touché. */
  stockSkipped: number;
  /** Identifiants demandés mais absents de la boutique. */
  skipped: number;
  errors: string[];
  updates: BulkProductUpdate[];
};

export type BulkUpdateResult = BulkUpdateSummary & {
  success: boolean;
  error?: string;
};

/**
 * Plafond volontaire : la modification est séquentielle côté serveur et la
 * sélection ne doit pas devenir une opération de plusieurs minutes.
 */
export const MAX_BULK_PRODUCTS = 500;

/** Arrondi monétaire à 2 décimales, comme les colonnes `numeric(12, 2)`. */
export function roundBulkPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Applique une opération de prix à un montant existant.
 * Le résultat reste strictement positif : les colonnes produit l'exigent et
 * une variation de -100 % ne doit pas créer un produit à 0.
 */
export function applyPriceOperation(
  currentPrice: number,
  operation: { mode: BulkPriceMode; value: number },
): number {
  const base = Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice : 0;
  const value = Number(operation.value);

  let next = base;
  if (operation.mode === 'set') {
    next = value;
  } else if (operation.mode === 'percent') {
    next = base * (1 + value / 100);
  } else {
    next = base + value;
  }

  if (!Number.isFinite(next)) return 0.01;
  return Math.max(0.01, roundBulkPrice(next));
}

/** Applique une opération de stock ; le stock ne peut jamais devenir négatif. */
export function applyStockOperation(
  currentStock: number,
  operation: { mode: BulkStockMode; value: number },
): number {
  const base = Math.max(0, Math.round(Number(currentStock) || 0));
  const amount = Math.max(0, Math.round(Number(operation.value) || 0));

  if (operation.mode === 'set') return amount;
  if (operation.mode === 'add') return base + amount;
  return Math.max(0, base - amount);
}

/**
 * Valide un patch avant tout accès à la base.
 *
 * Le client s'en sert pour désactiver « Appliquer », le serveur pour refuser
 * une requête forgée : les deux chemins partagent donc strictement les mêmes
 * règles.
 */
export function validateBulkPatch(patch: BulkProductPatch | null | undefined): string | null {
  if (!patch || typeof patch !== 'object') return 'Aucune modification demandée.';

  const hasAnyField =
    !!patch.price ||
    !!patch.stock ||
    !!patch.category ||
    patch.unit !== undefined ||
    patch.isOnline !== undefined;

  if (!hasAnyField) {
    return 'Cochez au moins un champ à modifier.';
  }

  if (patch.price) {
    const { mode, value } = patch.price;
    if (mode !== 'set' && mode !== 'percent' && mode !== 'amount') {
      return 'Le mode de modification du prix est invalide.';
    }
    if (!Number.isFinite(value)) return 'Le prix saisi est invalide.';
    if (mode === 'set' && value <= 0) {
      return 'Le nouveau prix doit être supérieur à 0.';
    }
    if (mode === 'percent' && value <= -100) {
      return 'La variation de prix doit être supérieure à -100 %.';
    }
    if (mode !== 'set' && value === 0) {
      return 'Indiquez une variation de prix différente de 0.';
    }
  }

  if (patch.stock) {
    const { mode, value } = patch.stock;
    if (mode !== 'set' && mode !== 'add' && mode !== 'remove') {
      return 'Le mode de modification du stock est invalide.';
    }
    if (!Number.isFinite(value) || !Number.isInteger(value)) {
      return 'Le stock doit être un nombre entier.';
    }
    if (mode === 'set' && value < 0) {
      return 'Le stock ne peut pas être négatif.';
    }
    if (mode !== 'set' && value <= 0) {
      return 'La quantité à ajouter ou retirer doit être supérieure à 0.';
    }
  }

  if (patch.category) {
    const main = String(patch.category.mainCategory || '').trim();
    const sub = String(patch.category.category || '').trim();
    if (!main && !sub) return 'Choisissez au moins une catégorie.';
    if (main.length > 120 || sub.length > 120) {
      return 'Le nom de la catégorie est trop long (120 caractères maximum).';
    }
  }

  if (patch.unit !== undefined) {
    const unit = String(patch.unit).trim();
    if (!unit) return "L'unité de vente ne peut pas être vide.";
    if (unit.length > 30) return "L'unité de vente est trop longue (30 caractères maximum).";
  }

  if (patch.isOnline !== undefined && typeof patch.isOnline !== 'boolean') {
    return 'Le canal de vente est invalide.';
  }

  return null;
}

/**
 * Nettoie et normalise un patch reçu du client : seules les clés connues sont
 * conservées, les chaînes sont rognées et les nombres convertis. Sans cela, un
 * appel forgé pourrait glisser des champs arbitraires jusqu'à Drizzle.
 */
export function sanitizeBulkPatch(raw: unknown): BulkProductPatch {
  if (!raw || typeof raw !== 'object') return {};
  const source = raw as Record<string, unknown>;
  const patch: BulkProductPatch = {};

  const price = source.price as Record<string, unknown> | undefined;
  if (price && typeof price === 'object') {
    patch.price = {
      mode: price.mode as BulkPriceMode,
      value: Number(price.value),
    };
  }

  const stock = source.stock as Record<string, unknown> | undefined;
  if (stock && typeof stock === 'object') {
    patch.stock = {
      mode: stock.mode as BulkStockMode,
      value: Number(stock.value),
    };
  }

  const category = source.category as Record<string, unknown> | undefined;
  if (category && typeof category === 'object') {
    const mainCategory =
      typeof category.mainCategory === 'string' ? category.mainCategory.trim() : '';
    const childCategory =
      typeof category.category === 'string' ? category.category.trim() : '';
    if (mainCategory || childCategory) {
      patch.category = {
        ...(mainCategory ? { mainCategory } : {}),
        ...(childCategory ? { category: childCategory } : {}),
      };
    }
  }

  if (typeof source.unit === 'string') patch.unit = source.unit.trim();
  if (typeof source.isOnline === 'boolean') patch.isOnline = source.isOnline;

  return patch;
}
