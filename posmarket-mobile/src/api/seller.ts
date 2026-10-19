/**
 * API de l'espace vendeur (app mobile).
 *
 * Toutes les requêtes passent par `apiFetch` : le cookie de session Auth.js
 * donne accès aux routes `/api/marketplace/seller/*`, et la boutique courante
 * est transmise en paramètre explicite (`?storeId=` / corps JSON) — l'en-tête
 * `Cookie` posé à la main n'étant pas transmis de façon fiable par OkHttp, le
 * cookie `currentStoreId` seul ne suffit pas (il reste envoyé pour le web).
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
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  return apiFetch<SellerBootstrapResponse>(`/api/marketplace/seller/bootstrap${query}`, {
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
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  return apiFetch<SellerDashboardResponse>(`/api/marketplace/seller/dashboard${query}`, {
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}

// ── Point de vente (POS) ──────────────────────────────────────────

/** Client de la boutique (ligne Drizzle `customers`). */
export interface SellerCustomer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  totalSpent?: string | number;
  ordersCount?: number;
  /** Présent dans le type du web mais jamais fourni par la requête (segment
   * « Inactifs » toujours vide, comme là-bas). */
  lastOrderDate?: string | null;
  createdAt?: string;
}

export interface SellerPosResponse {
  success: boolean;
  error?: string;
  products?: import('@/types').Product[];
  customers?: SellerCustomer[];
  store?: SellerStoreRow | null;
}

/** Produits + clients + boutique du point de vente. */
export async function fetchSellerPos(
  storeId?: string | null,
): Promise<SellerPosResponse> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  return apiFetch<SellerPosResponse>(`/api/marketplace/seller/pos${query}`, {
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}

/** Compteurs de stock live des badges produit (sondés toutes les 5 s). */
export async function fetchSellerPosStock(
  storeId: string,
): Promise<{ success: boolean; stock?: Record<string, number>; error?: string }> {
  return apiFetch('/api/marketplace/seller/pos/stock', {
    method: 'POST',
    body: JSON.stringify({ storeId }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Codes promo actifs de la boutique. */
export async function fetchSellerPosCoupons(
  storeId: string,
): Promise<{ success: boolean; coupons?: import('@/types').Coupon[]; error?: string }> {
  return apiFetch(
    `/api/marketplace/seller/pos/coupons?storeId=${encodeURIComponent(storeId)}`,
    {
      extraCookies: [`currentStoreId=${storeId}`],
    },
  );
}

/** Ligne de commande envoyée à l'encaissement (recopiée par `createOrderAction`). */
export interface SellerPosOrderInput {
  customer?: { id?: string } | null;
  date?: string;
  status?: string;
  type?: 'IN_STORE' | 'PICKUP';
  paymentMethod?: string;
  subtotal?: number;
  total?: number;
  discountAmount?: number;
  promoCode?: string;
  items?: Array<{
    product?: { id?: string; price?: number } | null;
    quantity?: number;
    variantId?: string | null;
    variantLabel?: string | null;
    variantSku?: string | null;
    variantOptionValues?: Record<string, string> | null;
  }>;
}

/** Encaissement : enregistre la vente (commande + lignes + stock). */
export async function submitSellerPosOrder(
  storeId: string,
  order: SellerPosOrderInput,
): Promise<{ success: boolean; order?: { id?: string; status?: string; total?: number }; error?: string }> {
  return apiFetch('/api/marketplace/seller/pos/checkout', {
    method: 'POST',
    body: JSON.stringify({ storeId, order }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

// ── Commandes ─────────────────────────────────────────────────────

/** Commande renvoyée par `getOrdersAction` (liste paginée). */
export interface SellerOrderRow {
  id: string;
  date: string;
  status?: string | null;
  type?: string | null;
  paymentMethod?: string | null;
  subtotal?: number;
  total?: number;
  discountAmount?: number | null;
  promoCode?: string | null;
  /** Lignes déjà chargées avec la commande (repli du détail, comme le web). */
  items?: SellerOrderItemRow[];
  customer?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address?: string;
    totalSpent?: string | number;
    ordersCount?: number;
  };
}

export interface SellerOrdersPage {
  success: boolean;
  error?: string;
  orders?: SellerOrderRow[];
  hasMore?: boolean;
  total?: number;
}

/** Liste paginée des commandes (recherche + filtre de statut). */
export async function fetchSellerOrders(
  storeId: string,
  offset: number,
  limit: number,
  search: string,
  filterStatus: string,
): Promise<SellerOrdersPage> {
  const params = new URLSearchParams({
    storeId,
    offset: String(offset),
    limit: String(limit),
    search,
    filterStatus,
  });
  return apiFetch(`/api/marketplace/seller/orders?${params.toString()}`, {
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Article de commande (route `/orders/items`, équivalent `fetchOrderItems`). */
export interface SellerOrderItemRow {
  id?: string;
  orderId?: string;
  productId?: string | null;
  quantity: number;
  unitPrice?: string | number | null;
  total?: string | number | null;
  variantId?: string | null;
  variantLabel?: string | null;
  variantSku?: string | null;
  variantOptionValues?: Record<string, string> | null;
  product?: {
    id?: string;
    name?: string;
    price?: number;
    image?: string;
    unit?: string;
    businessType?: string;
    mainCategory?: string;
    wholesalePrice?: number;
    wholesaleMinQty?: number;
    wholesaleTiers?: Array<{ minQty: number; price: number }>;
  };
}

/** Articles d'une commande (détail de commande). */
export async function fetchSellerOrderItems(
  orderId: string,
): Promise<{ success: boolean; items?: SellerOrderItemRow[]; error?: string }> {
  return apiFetch(
    `/api/marketplace/seller/orders/items?orderId=${encodeURIComponent(orderId)}`,
  );
}

/** Change le statut d'une commande. */
export async function updateSellerOrderStatus(
  orderId: string,
  status: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/orders/status', {
    method: 'POST',
    body: JSON.stringify({ orderId, status }),
  });
}

/** Change le statut de plusieurs commandes. */
export async function bulkUpdateSellerOrderStatus(
  orderIds: string[],
  status: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/orders/bulk-status', {
    method: 'POST',
    body: JSON.stringify({ orderIds, status }),
  });
}

/** Supprime une commande. */
export async function deleteSellerOrder(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/orders/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

/** Supprime plusieurs commandes. */
export async function bulkDeleteSellerOrders(
  ids: string[],
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/orders/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

// ── Clients ───────────────────────────────────────────────────────

export interface SellerCustomersPage {
  success: boolean;
  error?: string;
  customers?: SellerCustomer[];
  hasMore?: boolean;
  total?: number;
}

/** Liste paginée des clients (recherche nom/téléphone). */
export async function fetchSellerCustomers(
  storeId: string,
  offset: number,
  limit: number,
  search: string,
): Promise<SellerCustomersPage> {
  const params = new URLSearchParams({
    storeId,
    offset: String(offset),
    limit: String(limit),
    search,
  });
  return apiFetch(`/api/marketplace/seller/customers?${params.toString()}`, {
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Client envoyé au formulaire « Nouveau Client » / « Modifier Client ». */
export interface SellerCustomerInput {
  id?: string;
  name?: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  totalSpent?: number;
  ordersCount?: number;
}

/** Crée ou met à jour un client. */
export async function saveSellerCustomer(
  storeId: string,
  customer: SellerCustomerInput,
): Promise<{ success: boolean; customer?: SellerCustomer; error?: string }> {
  return apiFetch('/api/marketplace/seller/customers/save', {
    method: 'POST',
    body: JSON.stringify({ ...customer, storeId }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Supprime un client. */
export async function deleteSellerCustomer(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/customers/delete', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

/** Supprime plusieurs clients. */
export async function bulkDeleteSellerCustomers(
  ids: string[],
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/customers/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
}

// ── Inventaire (Stocks) ───────────────────────────────────────────

export type SellerProductTypeFilter = 'all' | 'pos' | 'marketplace';
export type SellerProductVerticalFilter = 'all' | 'shopping' | 'food';

export interface SellerProductsPage {
  success: boolean;
  error?: string;
  products?: import('@/types').Product[];
  hasMore?: boolean;
  total?: number;
}

/** Liste paginée des produits (mêmes filtres que `getProductsAction`). */
export async function fetchSellerProducts(
  storeId: string,
  offset: number,
  limit: number,
  search: string,
  productType: SellerProductTypeFilter,
  businessType: SellerProductVerticalFilter,
): Promise<SellerProductsPage> {
  const params = new URLSearchParams({
    storeId,
    offset: String(offset),
    limit: String(limit),
    search,
    productType,
    businessType,
  });
  return apiFetch(`/api/marketplace/seller/inventory?${params.toString()}`, {
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Nœud de l'arbre de catégories (`getProductCategoryTree`). */
export interface SellerCategoryNode {
  id: string;
  name: string;
  businessType: string;
  children: SellerCategoryNode[];
}

/** Taxonomie produit (repli sur les constantes si vide, comme le web). */
export async function fetchSellerProductCategories(
  businessType: 'shopping' | 'food',
): Promise<{ success: boolean; tree?: SellerCategoryNode[]; error?: string }> {
  const params = new URLSearchParams({ categories: '1', businessType });
  return apiFetch(`/api/marketplace/seller/inventory?${params.toString()}`);
}

/** Crée ou met à jour un produit (modale produit). */
export async function saveSellerProduct(
  storeId: string,
  product: Record<string, unknown>,
): Promise<{
  success: boolean;
  product?: import('@/types').Product;
  warnings?: string[];
  error?: string;
}> {
  return apiFetch('/api/marketplace/seller/inventory/save', {
    method: 'POST',
    body: JSON.stringify({ storeId, product }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Supprime un produit. */
export async function deleteSellerProduct(
  storeId: string,
  id: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/inventory/delete', {
    method: 'POST',
    body: JSON.stringify({ storeId, id }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Supprime plusieurs produits. */
export async function bulkDeleteSellerProducts(
  storeId: string,
  ids: string[],
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/inventory/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ storeId, ids }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Boutiques gérables par l'utilisateur (modale de transfert). */
export async function fetchSellerManageableStores(): Promise<{
  success: boolean;
  stores?: Array<{
    id: string;
    name: string;
    slug: string;
    businessType: string;
    isOwner: boolean;
  }>;
  error?: string;
}> {
  return apiFetch('/api/marketplace/seller/inventory/stores');
}

/** Export JSON/CSV des produits (`exportStoreProductsAction`). */
export async function exportSellerProducts(
  storeId: string,
  ids?: string[],
): Promise<{
  success: boolean;
  products?: Array<Record<string, unknown>>;
  store?: { id: string; name: string; businessType: string };
  error?: string;
}> {
  return apiFetch('/api/marketplace/seller/inventory/export', {
    method: 'POST',
    body: JSON.stringify({ storeId, ids }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

export interface SellerImportOptions {
  duplicateStrategy: 'skip' | 'update' | 'create_new';
  resetStock?: boolean;
  forceOnlineStatus?: 'keep' | 'online' | 'pos';
}

export interface SellerImportResult {
  success: boolean;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  totalProcessed: number;
  errors: string[];
  error?: string;
}

/** Import groupé de produits (CSV/JSON analysés côté app). */
export async function importSellerProducts(
  storeId: string,
  items: Array<Record<string, unknown>>,
  options: SellerImportOptions,
): Promise<SellerImportResult> {
  return apiFetch('/api/marketplace/seller/inventory/import', {
    method: 'POST',
    body: JSON.stringify({ storeId, items, options }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

export interface SellerTransferOptions {
  duplicateStrategy: 'skip' | 'update' | 'create_new';
  copyStock: boolean;
  priceAdjustmentPercent?: number;
  priceAdjustmentFixed?: number;
  forceOnlineStatus?: 'keep' | 'online' | 'pos';
}

/** Copie / transfert de produits vers une autre boutique. */
export async function transferSellerProducts(
  sourceStoreId: string,
  targetStoreId: string,
  productIds: string[],
  options: SellerTransferOptions,
): Promise<SellerImportResult> {
  return apiFetch('/api/marketplace/seller/inventory/transfer', {
    method: 'POST',
    body: JSON.stringify({ sourceStoreId, targetStoreId, productIds, options }),
    extraCookies: [`currentStoreId=${sourceStoreId}`],
  });
}
