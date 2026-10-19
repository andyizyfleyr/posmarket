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

/** Correspondance sous-catégorie → rayon (copie web). */
export const CATEGORY_MAPPING: Record<string, string> = {
  'Boîtes pour Crème de Visage': 'Cosmétique & Emballage',
  'Boîtes pour Savon': 'Cosmétique & Emballage',
  'Boîtes pour Gel Douche': 'Cosmétique & Emballage',
  'Boîtes pour Poudre': 'Cosmétique & Emballage',
  'Boîtes pour Parfum': 'Cosmétique & Emballage',
  'Boîtes pour Lotion': 'Cosmétique & Emballage',
  'Boîtes pour Huile': 'Cosmétique & Emballage',
  'Boîtes pour Sérum': 'Cosmétique & Emballage',
  'Matière Première': 'Cosmétique & Emballage',
  'Outils Professionnels': 'Cosmétique & Emballage',
  'Électronique': 'Électronique & High-Tech',
  'Téléphones & Tablettes': 'Électronique & High-Tech',
  'Audio': 'Électronique & High-Tech',
  'Gaming': 'Électronique & High-Tech',
  'Télévision': 'Électronique & High-Tech',
  'Beauté': 'Beauté, Santé & Bien-être',
  'Maquillage & Soins': 'Beauté, Santé & Bien-être',
  'Santé': 'Beauté, Santé & Bien-être',
  'Vêtements': 'Mode & Accessoires',
  'Chaussures': 'Mode & Accessoires',
  'Montres': 'Mode & Accessoires',
  'Sacs & Bagages': 'Mode & Accessoires',
  'Alimentation': 'Épicerie & Supermarché',
  'Boissons': 'Épicerie & Supermarché',
  'Légumes & Fruits': 'Épicerie & Supermarché',
  'Petit Déjeuner Resto': 'Restauration & Livraison Rapide',
  'Déjeuner Resto': 'Restauration & Livraison Rapide',
  'Dîner Resto': 'Restauration & Livraison Rapide',
  'Plats Cuisinés': 'Restauration & Livraison Rapide',
  'Fast-Food & Snacks': 'Restauration & Livraison Rapide',
  'Desserts & Douceurs': 'Restauration & Livraison Rapide',
  'Boissons Resto': 'Restauration & Livraison Rapide',
  'Mobilier': 'Mobilier & Décoration',
  'Sport': 'Sport & Loisirs',
  'Loisirs': 'Sport & Loisirs',
  'Auto': 'Auto & Moto',
  'Moto': 'Auto & Moto',
  'Bricolage': 'Bricolage & Jardin',
  'Jardin': 'Bricolage & Jardin',
  'Livres Physique': 'Livres & Papeterie',
  'Papeterie': 'Livres & Papeterie',
  'Jouets': 'Jouets & Enfants',
  'Bébés': 'Jouets & Enfants',
  'Général': 'Divers',
};

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

/**
 * Libellés dépendant de la verticale (copie web) : un resto parle de
 * « commande », un shop de « panier ».
 */
export function cartNoun(vertical: 'shopping' | 'food'): string {
  return vertical === 'food' ? 'Commande' : 'Panier';
}

export function cartNounLower(vertical: 'shopping' | 'food'): string {
  return vertical === 'food' ? 'commande' : 'panier';
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
