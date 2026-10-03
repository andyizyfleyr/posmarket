
import { SubscriptionPlan, SubscriptionTier } from '@/types';
 
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
  'Divers'
];

/**
 * Taxonomie par verticale.
 *
 * `MAIN_CATEGORIES` mélange historiquement commerce et restauration : sans ce
 * découpage, un produit de resto apparaissait dans les sections d'un shop et
 * l'inverse. Les catégories Food comme Shopping ne doivent jamais être
 * mélangées, pas plus que leurs produits.
 */
export const FOOD_MAIN_CATEGORIES = [
  'Restauration & Livraison Rapide',
  'Épicerie & Supermarché',
];

export const SHOPPING_MAIN_CATEGORIES = MAIN_CATEGORIES.filter(
  (category) => !FOOD_MAIN_CATEGORIES.includes(category),
);

/** Catégories de la verticale demandée, dans l'ordre d'affichage historique. */
export function categoriesForVertical(vertical: 'shopping' | 'food'): string[] {
  return vertical === 'food' ? FOOD_MAIN_CATEGORIES : SHOPPING_MAIN_CATEGORIES;
}

/** Verticale déduite du nom d'une catégorie. */
export function verticalOfCategory(category: string): 'shopping' | 'food' {
  return FOOD_MAIN_CATEGORIES.includes(category) ? 'food' : 'shopping';
}

/**
 * Verticale d'un produit. `businessType` fait foi ; à défaut, on retombe sur la
 * catégorie, la seule information disponible sur les anciennes données.
 */
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
 * Libellés dépendant de la verticale.
 *
 * Un resto ne parle pas de « panier » mais de « commande », et la vente en gros
 * n'a aucun sens pour de la restauration : les textes doivent suivre le type de
 * la boutique, sinon un shop affiche du vocabulaire de resto et inversement.
 */
export function cartNoun(vertical: 'shopping' | 'food'): string {
  return vertical === 'food' ? 'Commande' : 'Panier';
}

export function cartNounLower(vertical: 'shopping' | 'food'): string {
  return vertical === 'food' ? 'commande' : 'panier';
}

/** Les tarifs de gros n'existent que pour le commerce. */
export function wholesaleLabel(vertical: 'shopping' | 'food'): string {
  return vertical === 'food' ? 'Restauration' : 'Commerce';
}

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
  'Général': 'Divers'
};

export const SUBSCRIPTION_PLANS: Record<'STARTER' | 'PRO' | 'ENTERPRISE', SubscriptionPlan> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    description: 'Pour bien commencer.',
    priceMonthly: 12000,
    priceQuarterly: 32000,
    priceAnnual: 120000,
    features: {
      maxStores: 1,
      maxProducts: 50,
      enableStorefront: false,
      enableAdvancedReports: false,
      enableCustomReceipts: false
    }
  },
  PRO: {
    tier: 'PRO',
    name: 'Pro',
    description: 'Pour les commerces en croissance.',
    priceMonthly: 15000,
    priceQuarterly: 40000,
    priceAnnual: 150000,
    features: {
      maxStores: 3,
      maxProducts: 500,
      enableStorefront: true,
      enableAdvancedReports: true,
      enableCustomReceipts: false
    }
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Entreprise',
    description: 'Solution complète sans limites.',
    priceMonthly: 20000,
    priceQuarterly: 55000,
    priceAnnual: 200000,
    features: {
      maxStores: 999,
      maxProducts: 999999,
      enableStorefront: true,
      enableAdvancedReports: true,
      enableCustomReceipts: true
    }
  }
};

export function getSubscriptionPlan(tier: SubscriptionTier | null | undefined): SubscriptionPlan | undefined {
  if (!tier) return undefined;
  if (tier === 'NONE' || tier === 'UNKNOWN') return undefined;
  return SUBSCRIPTION_PLANS[tier];
}
