/**
 * API de la page Factures de l'espace vendeur mobile.
 *
 * Équivalent mobile de `src/views/InvoicesView.tsx` + de la page serveur
 * `src/app/(app)/invoices/page.tsx` (web) :
 * - `fetchSellerInvoices` → GET `/api/marketplace/seller/invoices` (factures,
 *   produits du sélecteur d'articles et boutique de la facture) ;
 * - `fetchSellerInvoiceItems` → GET `.../invoices/items` (table `invoice_items`,
 *   appelée à l'ouverture du détail, comme `fetchInvoiceItems` au web) ;
 * - `saveSellerInvoice` → POST `.../invoices/save` (chemin `saveInvoice` de
 *   `src/supabase-api.ts`, qui n'était pas branché sur la page web) ;
 * - `updateSellerInvoiceStatus` → POST `.../invoices/status` (select « Statut »
 *   de la modale détail).
 *
 * Les types de boutique sont redéfinis localement (le format `toSnakeStore`
 * du serveur) pour ne pas dépendre du module `@/api/seller`.
 */

import { apiFetch } from '@/api/client';
import type { Product } from '@/types';

/** Statuts bornés de la vue web (`getStatusColor` / `getStatusLabel`). */
export type SellerInvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';

/** Ligne de la table `invoices` au format renvoyé par la route (numéros). */
export interface SellerInvoice {
  id: string;
  invoiceNumber: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  /** ISO (Drizzle `timestamp` sérialisé). */
  date?: string | null;
  dueDate?: string | null;
  status?: string | null;
  notes?: string | null;
  subtotal?: number;
  total?: number;
}

/** Ligne de la table `invoice_items` (montants normalisés en nombres). */
export interface SellerInvoiceItem {
  id?: string;
  invoiceId?: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Ligne d'article saisie dans la modale « Nouvelle Facture ». */
export interface SellerInvoiceItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

/** Facture envoyée au serveur (`saveInvoiceAction`, id `temp-` = insertion). */
export interface SellerInvoiceInput {
  id?: string;
  invoiceNumber?: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerAddress?: string | null;
  date?: string | null;
  dueDate?: string | null;
  status?: string | null;
  notes?: string | null;
  subtotal?: number;
  total?: number;
  items: SellerInvoiceItemInput[];
}

/** Réglages de la boutique affichés sur la facture (format `toSnakeStore`). */
export interface InvoiceStoreSettings {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  [key: string]: unknown;
}

/** Boutique renvoyée par la route (format `toSnakeStore` du web). */
export interface InvoiceStore {
  id: string;
  name?: string | null;
  slug?: string | null;
  settings?: InvoiceStoreSettings | null;
  [key: string]: unknown;
}

export interface SellerInvoicesResponse {
  success: boolean;
  error?: string;
  invoices?: SellerInvoice[];
  products?: Product[];
  store?: InvoiceStore | null;
}

export interface SellerInvoiceItemsResponse {
  success: boolean;
  error?: string;
  items?: SellerInvoiceItem[];
}

export interface SellerInvoiceSaveResponse {
  success: boolean;
  error?: string;
  invoiceId?: string;
}

export interface SellerInvoiceStatusResponse {
  success: boolean;
  error?: string;
}

/**
 * Factures (100 max, ordre d'insertion), produits du sélecteur d'articles et
 * boutique de la page Factures.
 */
export async function fetchSellerInvoices(
  storeId?: string | null,
): Promise<SellerInvoicesResponse> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  return apiFetch<SellerInvoicesResponse>(`/api/marketplace/seller/invoices${query}`, {
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}

/** Articles d'une facture (chargés à l'ouverture du détail). */
export async function fetchSellerInvoiceItems(
  invoiceId: string,
): Promise<SellerInvoiceItemsResponse> {
  return apiFetch<SellerInvoiceItemsResponse>(
    `/api/marketplace/seller/invoices/items?invoiceId=${encodeURIComponent(invoiceId)}`,
  );
}

/** Enregistre la facture et ses articles (insertion ou mise à jour). */
export async function saveSellerInvoice(
  storeId: string,
  invoice: SellerInvoiceInput,
): Promise<SellerInvoiceSaveResponse> {
  return apiFetch<SellerInvoiceSaveResponse>('/api/marketplace/seller/invoices/save', {
    method: 'POST',
    body: JSON.stringify({ storeId, invoice }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

/** Change le statut d'une facture (Brouillon / Envoyée / Payée / En retard). */
export async function updateSellerInvoiceStatus(
  invoiceId: string,
  status: SellerInvoiceStatus,
): Promise<SellerInvoiceStatusResponse> {
  return apiFetch<SellerInvoiceStatusResponse>('/api/marketplace/seller/invoices/status', {
    method: 'POST',
    body: JSON.stringify({ invoiceId, status }),
  });
}
