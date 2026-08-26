
import { SubscriptionPlan } from '@/types';
 
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

export const CATEGORY_MAPPING: Record<string, string> = {
  'Boîtes pour Crème de Visage': 'Cosmétique & Emballage',
  'Boîtes pour Savon': 'Cosmétique & Emballage',
  'Boîtes pour Gel Douche': 'Cosmétique & Emballage',
  'Boîtes pour Poudre': 'Cosmétique & Emballage',
  'Boîtes pour Parfum': 'Cosmétique & Emballage',
  'Boîtes pour Lotion': 'Cosmétique & Emballage',
  'Boîtes pour Huile': 'Cosmétique & Emballage',
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
    priceMonthly: 25000,
    priceQuarterly: 40000,
    priceAnnual: 70000,
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
    priceMonthly: 40000,
    priceQuarterly: 60000,
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
    priceMonthly: 70000,
    priceQuarterly: 95000,
    priceAnnual: 350000,
    features: {
      maxStores: 999,
      maxProducts: 999999,
      enableStorefront: true,
      enableAdvancedReports: true,
      enableCustomReceipts: true
    }
  }
};
