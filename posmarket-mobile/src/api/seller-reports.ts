/**
 * API de la page Rapports (Historique) de l'espace vendeur mobile.
 *
 * Une seule requête paresseuse (GET) : la route web
 * `/api/marketplace/seller/reports` renvoie les 100 dernières commandes
 * (`loadOrdersForStore`) et la boutique — dont `settings`, utilisé par le
 * reçu — exactement comme `src/app/(app)/reports/page.tsx`.
 */

import { apiFetch } from '@/api/client';

/** Ligne de commande du ticket (`fetchFormattedOrders` du web). */
export interface ReportsOrderItem {
  product?: {
    id?: string;
    name?: string;
    price?: number;
    image?: string;
    unit?: string;
    sku?: string;
    businessType?: string;
    mainCategory?: string;
  } | null;
  quantity: number;
  unitPrice?: number;
  total?: number;
  variantLabel?: string | null;
  variantSku?: string | null;
}

/** Commande affichée dans l'historique (format identique au web). */
export interface ReportsOrder {
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
    totalSpent?: string | number;
    ordersCount?: number;
  };
  items: ReportsOrderItem[];
}

/** Réglages de boutique consommés par le reçu (sous-ensemble `store.settings`). */
export interface ReportsStoreSettings {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

/** Boutique renvoyée par la route (format `toSnakeStore`). */
export interface ReportsStore {
  id: string;
  name?: string;
  slug?: string;
  business_type?: 'shopping' | 'food';
  views?: number;
  settings?: ReportsStoreSettings;
  [key: string]: unknown;
}

export interface SellerReportsResponse {
  success: boolean;
  error?: string;
  orders?: ReportsOrder[];
  store?: ReportsStore | null;
}

/** Commandes (100 dernières) + boutique de la page Rapports. */
export async function fetchSellerReports(
  storeId?: string | null,
): Promise<SellerReportsResponse> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  return apiFetch<SellerReportsResponse>(`/api/marketplace/seller/reports${query}`, {
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}
