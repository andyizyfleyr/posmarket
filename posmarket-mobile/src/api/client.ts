/**
 * Client API — Phase 2.3 du plan.
 * Point d'entrée unique pour toutes les requêtes vers le backend PosMarket.
 *
 * Chaque appel porte le cookie de session acheteur (voir `session.ts`) : c'est
 * lui qui donne accès aux commandes, adresses, avis et au profil.
 */

import Constants from 'expo-constants';
import {
  sessionBearerToken,
  sessionCookieHeader,
  sessionVersion,
} from '@/api/session';

const API_BASE_URL =
  Constants.expoConfig?.extra?.API_BASE_URL ||
  'https://posmarket-eight.vercel.app';

/** Timeout par défaut pour les requêtes (ms). */
const DEFAULT_TIMEOUT = 15_000;

interface FetchOptions extends RequestInit {
  timeout?: number;
  /**
   * Cookies supplémentaires joints à celui de session (ex. `currentStoreId`
   * pour l'espace vendeur) : le serveur lit la boutique courante dans ce
   * cookie, exactement comme le fait le web.
   */
  extraCookies?: string[];
}

/**
 * Wrapper fetch avec timeout, cookie de session et gestion d'erreur uniforme.
 */
export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, extraCookies, ...fetchOpts } = options;
  const url = `${API_BASE_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  const [cookie, token] = await Promise.all([
    sessionCookieHeader().catch(() => null),
    sessionBearerToken().catch(() => null),
  ]);
  const versionAtRequest = sessionVersion();
  const cookieHeader = [cookie, ...(extraCookies || [])].filter(Boolean).join('; ');

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
        // Le cookie est la voie du web ; sur Android, OkHttp peut le remplacer
        // par son propre pot à cookies — l'en-tête `Authorization` ci-dessous
        // porte alors la session de façon fiable (voir `mobile-session.ts`).
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...fetchOpts.headers,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      throw new Error(
        `API ${response.status}: ${errorBody || response.statusText}`,
      );
    }

    return patchStaleAuth((await response.json()) as T, versionAtRequest);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Une réponse « Unauthorized » arrivée après un changement de session (connexion
 * ou déconnexion survenue pendant la requête) est obsolète : elle ne doit ni
 * déconnecter l'utilisateur ni déclencher « Session expirée ». On la marque
 * `UnauthorizedStale` pour que les écrans l'ignorent en silence.
 */
function patchStaleAuth<T>(data: T, versionAtRequest: number): T {
  if (versionAtRequest === sessionVersion()) return data;
  const record = data as unknown as { error?: unknown } | null;
  if (record && record.error === 'Unauthorized') {
    return Object.assign({}, record, { error: 'UnauthorizedStale' }) as unknown as T;
  }
  return data;
}

// ── Marketplace endpoints ─────────────────────────────────────────

import type {
  StoreData,
  StorefrontProduct,
  Review,
  Coupon,
  BuyerOrder,
  BuyerAddress,
  BuyerReview,
  BuyerProfile,
  NotificationPreference,
  NotificationOutboxItem,
} from '@/types';

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

/**
 * Charge le catalogue allégé de l'accueil (cartes produit + vitrines).
 * Les fiches boutique/produit continuent d'utiliser `fetchCatalog`.
 */
export async function fetchHomeCatalog(): Promise<CatalogResponse> {
  return apiFetch<CatalogResponse>('/api/marketplace/home');
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

interface CountryGateResponse {
  success: boolean;
  allowed: boolean;
  checked: boolean;
  countryCode: string | null;
  countryName: string | null;
  error?: string;
}

/** Portail pays du checkout (« Commande indisponible »). */
export async function fetchCountryGate(): Promise<CountryGateResponse> {
  return apiFetch<CountryGateResponse>('/api/marketplace/country-gate');
}

export interface CheckoutResponseOrderItem {
  id: string;
  productId: string | null;
  name: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  variantId: string | null;
  variantLabel: string | null;
  variantOptionValues: Record<string, string>;
}

export interface CheckoutResponseOrder {
  id: string;
  storeId: string;
  storeName: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  status: string;
  items: CheckoutResponseOrderItem[];
}

interface CheckoutResponse {
  success: boolean;
  orderId?: string;
  orderIds?: string[];
  orders?: CheckoutResponseOrder[];
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

// ── Connexion / espace acheteur ───────────────────────────────────

export interface LoginBuyerPayload {
  email: string;
  name?: string;
  mode: 'login' | 'register';
}

export interface LoginBuyerResponse {
  success: boolean;
  /** `true` quand un e-mail de connexion a dû être envoyé (repli). */
  sent?: boolean;
  user?: BuyerProfile & { name: string };
  session?: { name: string; value: string };
  error?: string;
}

/** Connexion acheteur (lien magique échangé côté serveur contre une session). */
export async function loginBuyer(
  payload: LoginBuyerPayload,
): Promise<LoginBuyerResponse> {
  return apiFetch<LoginBuyerResponse>('/api/marketplace/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

interface OrdersResponse {
  success: boolean;
  orders: BuyerOrder[];
  totalCount?: number;
  error?: string;
}

/** Commandes de l'acheteur connecté (paginées). */
export async function fetchBuyerOrders(
  page = 1,
  limit = 10,
): Promise<OrdersResponse> {
  return apiFetch<OrdersResponse>(
    `/api/marketplace/buyer/orders?page=${page}&limit=${limit}`,
  );
}

interface AddressesResponse {
  success: boolean;
  addresses: BuyerAddress[];
  error?: string;
}

export async function fetchBuyerAddresses(): Promise<AddressesResponse> {
  return apiFetch<AddressesResponse>('/api/marketplace/buyer/addresses');
}

export async function saveBuyerAddress(
  address: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/buyer/addresses', {
    method: 'POST',
    body: JSON.stringify(address),
  });
}

export async function deleteBuyerAddress(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch(
    `/api/marketplace/buyer/addresses?id=${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

interface ProfileResponse {
  success: boolean;
  profile?: BuyerProfile;
  user?: BuyerProfile;
  error?: string;
}

export async function fetchBuyerProfile(): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/api/marketplace/buyer/profile');
}

export async function updateBuyerProfile(payload: {
  fullName?: string;
  phone?: string;
  avatarUrl?: string | null;
}): Promise<ProfileResponse> {
  return apiFetch<ProfileResponse>('/api/marketplace/buyer/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

interface BuyerReviewsResponse {
  success: boolean;
  reviews: BuyerReview[];
  error?: string;
}

export async function fetchBuyerReviews(): Promise<BuyerReviewsResponse> {
  return apiFetch<BuyerReviewsResponse>('/api/marketplace/buyer/reviews');
}

export async function saveBuyerReview(payload: {
  storeId: string;
  productId: string;
  rating: number;
  comment: string;
  author?: string;
}): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/buyer/reviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

interface NotificationPrefsResponse {
  success: boolean;
  preferences: NotificationPreference[];
  error?: string;
}

export async function fetchNotificationPreferences(): Promise<NotificationPrefsResponse> {
  return apiFetch<NotificationPrefsResponse>('/api/marketplace/buyer/notifications');
}

interface NotificationOutboxResponse {
  success: boolean;
  outbox: NotificationOutboxItem[];
  error?: string;
}

export async function fetchNotificationOutbox(
  limit = 30,
): Promise<NotificationOutboxResponse> {
  return apiFetch<NotificationOutboxResponse>(
    `/api/marketplace/buyer/notifications?outbox=1&limit=${limit}`,
  );
}

export async function setNotificationPreference(payload: {
  eventType: string;
  channel: 'whatsapp' | 'email' | 'push';
  enabled: boolean;
  whatsappPhone?: string;
  emailAddress?: string;
}): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/buyer/notifications', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

interface PushTokenResponse {
  success: boolean;
  error?: string;
}

/** Enregistre le jeton push Expo de l'appareil pour l'utilisateur connecté. */
export async function registerPushToken(payload: {
  token: string;
  platform: 'ios' | 'android';
  deviceName?: string;
}): Promise<PushTokenResponse> {
  return apiFetch<PushTokenResponse>('/api/marketplace/push-token', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** Désactive le jeton push à la déconnexion. */
export async function unregisterPushToken(token: string): Promise<PushTokenResponse> {
  return apiFetch<PushTokenResponse>('/api/marketplace/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
    // La déconnexion ne doit pas rester bloquée si le réseau est lent.
    timeout: 4000,
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
