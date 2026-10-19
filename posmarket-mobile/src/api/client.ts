/**
 * Client API — Phase 2.3 du plan.
 * Point d'entrée unique pour toutes les requêtes vers le backend PosMarket.
 */

import Constants from 'expo-constants';

const API_BASE_URL =
  Constants.expoConfig?.extra?.API_BASE_URL ||
  'https://posmarket-eight.vercel.app';

/** Timeout par défaut pour les requêtes (ms). */
const DEFAULT_TIMEOUT = 15_000;

interface FetchOptions extends RequestInit {
  timeout?: number;
}

/**
 * Wrapper fetch avec timeout et gestion d'erreur uniforme.
 */
async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOpts } = options;
  const url = `${API_BASE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOpts,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Sans en-tête dédié, le proxy du serveur bloque l'UA des requêtes
        // React Native (okhttp) comme un bot (403 Forbidden).
        'X-PosMarket-Client': 'mobile-app',
        'User-Agent': 'PosMarket-Mobile/1.0 (Android)',
        ...fetchOpts.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `API ${response.status}: ${errorBody || response.statusText}`,
      );
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── Marketplace endpoints ─────────────────────────────────────────

import type { StoreData, StorefrontProduct, Review, Coupon } from '@/types';

interface CatalogResponse {
  success: boolean;
  stores: StoreData[];
  error?: string;
}

interface SearchResponse {
  success: boolean;
  products: StorefrontProduct[];
  error?: string;
}

interface ReviewsResponse {
  success: boolean;
  reviews: Review[];
  error?: string;
}

/** Charge le catalogue complet (boutiques + produits). */
export async function fetchCatalog(): Promise<CatalogResponse> {
  return apiFetch<CatalogResponse>('/api/marketplace/catalog');
}

/** Recherche de produits (FTS + trigram). */
export async function searchProducts(
  query: string,
  limit = 30,
): Promise<SearchResponse> {
  const q = encodeURIComponent(query.trim());
  return apiFetch<SearchResponse>(
    `/api/marketplace/search?q=${q}&limit=${limit}`,
  );
}

/** Avis d'un produit. */
export async function fetchProductReviews(
  productId: string,
): Promise<ReviewsResponse> {
  return apiFetch<ReviewsResponse>(
    `/api/marketplace/reviews/${encodeURIComponent(productId)}`,
  );
}

/** Avis d'une boutique (tous ses produits confondus). */
export async function fetchStoreReviews(
  storeId: string,
): Promise<ReviewsResponse> {
  return apiFetch<ReviewsResponse>(
    `/api/marketplace/store-reviews/${encodeURIComponent(storeId)}`,
  );
}

interface CouponsResponse {
  success: boolean;
  coupons: Coupon[];
  error?: string;
}

/** Codes promo actifs des boutiques demandées (panier acheteur). */
export async function fetchCoupons(
  storeIds: string[],
): Promise<CouponsResponse> {
  const ids = encodeURIComponent(storeIds.filter(Boolean).join(','));
  return apiFetch<CouponsResponse>(`/api/marketplace/coupons?storeIds=${ids}`);
}

interface CheckoutResponse {
  success: boolean;
  orderId?: string;
  orderIds?: string[];
  error?: string;
}

export async function submitCheckout(payload: {
  orders: Record<string, unknown>;
  customer: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<CheckoutResponse> {
  return apiFetch<CheckoutResponse>('/api/marketplace/checkout', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchBuyerOrders(fallback?: string): Promise<{
  success: boolean;
  orders: unknown[];
  totalCount?: number;
  error?: string;
}> {
  const query = fallback ? `?email=${encodeURIComponent(fallback)}` : '';
  return apiFetch(`/api/marketplace/buyer/orders${query}`);
}

export async function fetchBuyerAddresses(fallback?: string): Promise<{
  success: boolean;
  addresses: unknown[];
  error?: string;
}> {
  const query = fallback ? `?email=${encodeURIComponent(fallback)}` : '';
  return apiFetch(`/api/marketplace/buyer/addresses${query}`);
}

export async function saveBuyerAddress(address: Record<string, unknown>): Promise<{
  success: boolean;
  error?: string;
}> {
  return apiFetch('/api/marketplace/buyer/addresses', {
    method: 'POST',
    body: JSON.stringify(address),
  });
}

export async function deleteBuyerAddress(id: string, fallback?: string): Promise<{
  success: boolean;
  error?: string;
}> {
  const query = fallback
    ? `?id=${encodeURIComponent(id)}&email=${encodeURIComponent(fallback)}`
    : `?id=${encodeURIComponent(id)}`;
  return apiFetch(`/api/marketplace/buyer/addresses${query}`, {
    method: 'DELETE',
  });
}

/** Vérifie la connectivité avec le serveur. */
export async function ping(): Promise<boolean> {
  try {
    const res = await apiFetch<{ ok: boolean }>('/api/ping', {
      timeout: 5000,
    });
    return res.ok === true;
  } catch {
    return false;
  }
}

/**
 * Résout l'URL complète d'une image produit.
 * Les images relatives (/api/image/xxx) sont préfixées par l'URL du serveur.
 */
export function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
  return url;
}

export { API_BASE_URL };

