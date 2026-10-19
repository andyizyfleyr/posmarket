/**
 * API de l'espace vendeur (app mobile).
 *
 * Toutes les requêtes passent par `apiFetch` : le cookie de session Auth.js
 * donne accès aux routes `/api/marketplace/seller/*`, et la boutique courante
 * est transmise dans le cookie `currentStoreId` (même mécanisme que le web).
 */

import { apiFetch } from '@/api/client';

export interface SellerUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  isSuperAdmin: boolean;
}

export interface SellerStoreSettings {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  ninea?: string;
  description?: string;
  logo?: string;
  [key: string]: unknown;
}

export interface SellerStore {
  id: string;
  slug: string;
  name: string;
  status: string;
  businessType: string;
  description: string;
  logo: string;
  ownerId: string;
  views: number;
  settings: SellerStoreSettings;
  staff: Array<{ id: string; userId: string; storeId: string; role: string }>;
}

export interface SellerSubscription {
  tier: string;
  duration: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface SellerPlan {
  tier: string;
  name: string;
  description: string;
  priceMonthly: number;
  priceQuarterly: number;
  priceAnnual: number;
  features: {
    maxStores: number;
    maxProducts: number;
    enableStorefront: boolean;
    enableAdvancedReports: boolean;
    enableCustomReceipts: boolean;
  };
}

export type SellerRole = 'OWNER' | 'SELLER' | 'SUPER_ADMIN' | string;

export interface SellerBootstrapResponse {
  success: boolean;
  error?: string;
  space?: string;
  user?: SellerUser;
  stores?: SellerStore[];
  currentStoreId?: string | null;
  role?: SellerRole;
  permissions?: Record<string, boolean>;
  subscription?: SellerSubscription;
  plan?: SellerPlan;
  subscriptionValid?: boolean;
}

export interface LoginSellerPayload {
  email: string;
  name?: string;
  mode: 'login' | 'register';
}

export interface LoginSellerResponse {
  success: boolean;
  /** `true` quand un e-mail de connexion a dû être envoyé (repli). */
  sent?: boolean;
  user?: { id: string; email: string; name: string; avatarUrl: string | null };
  session?: { name: string; value: string };
  error?: string;
}

/** Connexion vendeur (lien magique échangé côté serveur contre une session). */
export async function loginSeller(
  payload: LoginSellerPayload,
): Promise<LoginSellerResponse> {
  return apiFetch<LoginSellerResponse>('/api/marketplace/seller/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Données de coquille de l'espace vendeur (boutiques, rôle, abonnement…). */
export async function fetchSellerBootstrap(
  storeId?: string | null,
): Promise<SellerBootstrapResponse> {
  return apiFetch<SellerBootstrapResponse>('/api/marketplace/seller/bootstrap', {
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}

/** Actions « boutique » (création, suppression, réglages). */
export async function sellerStoreAction(payload: {
  action: 'create' | 'delete' | 'settings';
  name?: string;
  businessType?: 'shopping' | 'food';
  storeId?: string;
  settings?: Record<string, unknown>;
}): Promise<{ success: boolean; error?: string; store?: { id: string } }> {
  return apiFetch('/api/marketplace/seller/store', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ── Tableau de bord ────────────────────────────────────────────────

/** Ligne de commande formatée par `fetchFormattedOrders` (web). */
export interface SellerOrderItem {
  product?: {
    id?: string;
    name?: string;
    price?: number;
    image?: string;
    unit?: string;
    businessType?: string;
    mainCategory?: string;
  } | null;
  quantity: number;
  unitPrice?: number;
  total?: number;
  variantLabel?: string | null;
  variantSku?: string | null;
}

export interface SellerOrder {
  id: string;
  date: string;
  status?: string;
  type?: string;
  paymentMethod?: string;
  subtotal?: number;
  total: number;
  discountAmount?: number;
  promoCode?: string | null;
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address?: string;
    totalSpent?: number;
    ordersCount?: number;
  };
  items: SellerOrderItem[];
}

/** Boutique au format `toSnakeStore` (web). */
export interface SellerStoreRow {
  id: string;
  name?: string;
  slug?: string;
  business_type?: 'shopping' | 'food';
  views?: number;
  settings?: Record<string, unknown> & {
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    description?: string;
    logo?: string;
  };
  [key: string]: unknown;
}

export interface SellerDashboardResponse {
  success: boolean;
  error?: string;
  orders?: SellerOrder[];
  products?: import('@/types').Product[];
  store?: SellerStoreRow | null;
}

/** Données du tableau de bord (commandes + produits + boutique). */
export async function fetchSellerDashboard(
  storeId?: string | null,
): Promise<SellerDashboardResponse> {
  return apiFetch<SellerDashboardResponse>('/api/marketplace/seller/dashboard', {
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}
