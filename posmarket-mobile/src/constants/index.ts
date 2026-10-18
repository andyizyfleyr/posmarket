/**
 * Constants — copie du projet web (src/constants.ts).
 * Catégories et taxonomie par verticale.
 */

export const MAIN_CATEGORIES = [
  'Cosmétique & Emballage',
  'Électronique & High-Tech',
  'Mode & Accessoires',
  'Épicerie & Supermarché',
  'Restauration & Livraison Rapide',
  'Mobilier & Décoration',
  'Beauté, Santé & Bien-être',
  'Auto & Moto',
  'Sport & Loisirs',
  'Bricolage & Jardin',
  'Livres & Papeterie',
  'Jouets & Enfants',
  'Divers',
];

export const FOOD_MAIN_CATEGORIES = [
  'Restauration & Livraison Rapide',
  'Épicerie & Supermarché',
];

export const SHOPPING_MAIN_CATEGORIES = MAIN_CATEGORIES.filter(
  (category) => !FOOD_MAIN_CATEGORIES.includes(category),
);

export function verticalOfCategory(category: string): 'shopping' | 'food' {
  return FOOD_MAIN_CATEGORIES.includes(category) ? 'food' : 'shopping';
}

export function verticalOfProduct(product: {
  businessType?: string | null;
  mainCategory?: string | null;
  category?: string | null;
}): 'shopping' | 'food' {
  if (product.businessType === 'food') return 'food';
  if (product.businessType === 'shopping') return 'shopping';
  return verticalOfCategory(product.mainCategory || product.category || '');
}

/** Catégories par icône pour affichage dans les filtres mobile. */
export const CATEGORY_ICONS: Record<string, string> = {
  'Cosmétique & Emballage': '💄',
  'Électronique & High-Tech': '📱',
  'Mode & Accessoires': '👗',
  'Épicerie & Supermarché': '🛒',
  'Restauration & Livraison Rapide': '🍔',
  'Mobilier & Décoration': '🛋️',
  'Beauté, Santé & Bien-être': '✨',
  'Auto & Moto': '🚗',
  'Sport & Loisirs': '⚽',
  'Bricolage & Jardin': '🔧',
  'Livres & Papeterie': '📚',
  'Jouets & Enfants': '🧸',
  'Divers': '📦',
};
