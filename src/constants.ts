
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
  'Maison & Bureau',
  'Mode & Beauté',
  'Alimentation & Boissons',
  'Santé & Bien-être',
  'Sport & Loisirs',
  'Auto & Moto',
  'Jouets & Enfants',
  'Bricolage & Jardin',
  'Livres & Papeterie',
  'Immobilier',
  'Restaurants & Gastronomie',
  'Produits Digitaux & Services',
  'Divers'
];

export const CATEGORY_MAPPING: Record<string, string> = {
  'Électronique': 'Électronique & High-Tech',
  'Audio': 'Électronique & High-Tech',
  'Gaming': 'Électronique & High-Tech',
  'Télévision': 'Électronique & High-Tech',
  'Maison': 'Maison & Bureau',
  'Bureau': 'Maison & Bureau',
  'Accessoires': 'Mode & Beauté',
  'Vêtements': 'Mode & Beauté',
  'Beauté': 'Santé & Bien-être',
  'Alimentation': 'Alimentation & Boissons',
  'Boissons': 'Alimentation & Boissons',
  'Sport': 'Sport & Loisirs',
  'Loisirs': 'Sport & Loisirs',
  'Auto': 'Auto & Moto',
  'Moto': 'Auto & Moto',
  'Jouets': 'Jouets & Enfants',
  'Enfants': 'Jouets & Enfants',
  'Bricolage': 'Bricolage & Jardin',
  'Jardin': 'Bricolage & Jardin',
  'Livres': 'Livres & Papeterie',
  'Papeterie': 'Livres & Papeterie',
  'Appartements': 'Immobilier',
  'Petit Déjeuner': 'Restaurants & Gastronomie',
  'Déjeuner': 'Restaurants & Gastronomie',
  'Dîner': 'Restaurants & Gastronomie',
  'Fast-Food': 'Restaurants & Gastronomie',
  'Desserts': 'Restaurants & Gastronomie',
  'Boissons Resto': 'Restaurants & Gastronomie',
  'E-books': 'Produits Digitaux & Services',
  'Logiciels': 'Produits Digitaux & Services',
  'Formations Online': 'Produits Digitaux & Services',
  'Cartes Cadeaux': 'Produits Digitaux & Services',
  'Abonnements': 'Produits Digitaux & Services',
  'Services (Freelance)': 'Produits Digitaux & Services',
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

export const SUBSCRIPTION_PLANS: Record<'BASIC' | 'PRO' | 'ENTERPRISE', SubscriptionPlan> = {
  BASIC: {
    tier: 'BASIC',
    name: 'Débutant',
    description: 'Idéal pour démarrer votre petite activité.',
    priceMonthly: 0,
    priceQuarterly: 0,
    priceAnnual: 0,
    features: {
      maxStores: 1,
      maxProducts: 6,
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
      enableStorefront: false,
      enableAdvancedReports: true,
      enableCustomReceipts: true
    }
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Entreprise',
    description: 'Solution complète sans limites.',
    priceMonthly: 35000,
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
