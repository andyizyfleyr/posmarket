import type { Product } from '@/types';

/**
 * État du formulaire produit.
 *
 * Extraite de `InventoryView` parce que les étapes du formulaire vivent
 * désormais dans des composants dédiés : sans ce type nommé, chaque étape
 * redéclarait `Partial<Product> & { isOnline: boolean; images: string[] }` et
 * le risque de divergence était réel.
 */
export type ProductFormData = Partial<Product> & {
  isOnline: boolean;
  images: string[];
};

/** Nombre de photos acceptées pour un produit. */
export const MAX_PRODUCT_IMAGES = 8;