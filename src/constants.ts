
import { Product, Customer, StoreSettings, SubscriptionPlan } from '@/types';

export const DEFAULT_STORE_SETTINGS: StoreSettings = {
  name: "POS Pro Dakar",
  email: "contact@pospro.sn",
  phone: "+221 33 800 00 00",
  address: "Avenue Cheikh Anta Diop, Dakar",
  ninea: "SN 001234567"
};
 
export const MAIN_CATEGORIES = [
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

export const PRODUCTS: Product[] = [
  {
    id: '1',
    sku: 'VY-137-A1',
    barcode: '9851605829838',
    name: 'Liseuse Kindle Paperwhite',
    price: 1238,
    image: 'https://picsum.photos/seed/kindle/400/300',
    stock: 36,
    category: 'Électronique',
    mainCategory: 'Électronique & High-Tech'
  },
  {
    id: '2',
    sku: 'OJ-140-A1',
    barcode: '9218461096277',
    name: 'GoPro HERO10 Black',
    price: 749,
    originalPrice: 960,
    image: 'https://picsum.photos/seed/gopro/400/300',
    stock: 42,
    category: 'Électronique',
    mainCategory: 'Électronique & High-Tech',
    hasOptions: true
  },
  {
    id: '3',
    sku: 'FK-135',
    barcode: '0804488039787',
    name: 'Batterie Externe Anker PowerCore',
    price: 109,
    originalPrice: 447,
    image: 'https://picsum.photos/seed/anker/400/300',
    stock: 16,
    category: 'Accessoires',
    mainCategory: 'Mode & Beauté'
  },
  {
    id: '4',
    sku: 'GV-125',
    barcode: '8197752924868',
    name: 'Montre de Luxe (Produit 54)',
    price: 848,
    originalPrice: 1283,
    image: 'https://picsum.photos/seed/watch/400/300',
    stock: 13,
    category: 'Accessoires',
    mainCategory: 'Mode & Beauté'
  },
  {
    id: '5',
    sku: 'YM-175-A1',
    barcode: '1939540765874',
    name: 'Écouteurs Bose QuietComfort',
    price: 93,
    image: 'https://picsum.photos/seed/bose/400/300',
    stock: 19,
    category: 'Audio',
    mainCategory: 'Électronique & High-Tech',
    hasOptions: true
  },
  {
    id: '6',
    sku: 'H3-109',
    barcode: '8694063449375',
    name: 'Téléviseur LG OLED Série C1',
    price: 45,
    originalPrice: 51,
    image: 'https://picsum.photos/seed/lgtv/400/300',
    stock: 10,
    category: 'Télévision',
    mainCategory: 'Électronique & High-Tech'
  },
  {
    id: '7',
    sku: 'FD-141',
    barcode: '1596200835102',
    name: 'Aspirateur Dyson V11',
    price: 325,
    originalPrice: 716,
    image: 'https://picsum.photos/seed/dyson/400/300',
    stock: 19,
    category: 'Maison',
    mainCategory: 'Maison & Bureau'
  },
  {
    id: '8',
    sku: 'SO-148-A1',
    barcode: '4488902340862',
    name: 'Nintendo Switch Modèle OLED',
    price: 633,
    image: 'https://picsum.photos/seed/switch/400/300',
    stock: 57,
    category: 'Gaming',
    mainCategory: 'Électronique & High-Tech'
  }
];

export const CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'John Doe', email: 'john@exemple.fr', phone: '06 01 02 03 04', address: 'Dakar, Sénégal', totalSpent: 0, ordersCount: 0 },
  { id: 'c2', name: 'Sarah Wilson', email: 'sarah@exemple.fr', phone: '06 02 03 04 05', address: 'Dakar, Sénégal', totalSpent: 0, ordersCount: 0 },
  { id: 'c3', name: 'Michel Brun', email: 'michel@exemple.fr', phone: '06 03 04 05 06', address: 'Dakar, Sénégal', totalSpent: 0, ordersCount: 0 },
];

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
      enableStorefront: true,
      enableAdvancedReports: true,
      enableCustomReceipts: true
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
      enableCustomReceipts: true
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
