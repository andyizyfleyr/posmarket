/**
 * API Réglages de l'espace vendeur (app mobile).
 *
 * Toutes les requêtes passent par `apiFetch` et visent les routes
 * `/api/marketplace/seller/settings/*`, qui réutilisent les server actions du
 * web (`updateStoreSettingsAction`, `saveCouponAction`, `addStaffAction`…).
 * La boutique courante est transmise via le cookie `currentStoreId`, comme
 * pour le reste de l'espace vendeur.
 */

import { apiFetch } from '@/api/client';
import type { Coupon, StoreSettings } from '@/types';

/** Membre d'équipe renvoyé par la route Réglages (jointure `profiles`). */
export interface SellerSettingsStaff {
  id: string;
  userId: string;
  storeId: string;
  role: string;
  email?: string | null;
  fullName?: string | null;
}

/** Utilisateur connecté (profil) — nom/photo mis à jour depuis l'onglet Profil. */
export interface SellerSettingsUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
}

export interface SellerSettingsResponse {
  success: boolean;
  error?: string;
  storeSettings?: StoreSettings;
  staff?: SellerSettingsStaff[];
  coupons?: Coupon[];
  user?: SellerSettingsUser;
}

/** Charge en une fois les réglages, l'équipe, les coupons et le profil. */
export async function fetchSellerSettings(
  storeId: string | null,
): Promise<SellerSettingsResponse> {
  const query = storeId ? `?storeId=${encodeURIComponent(storeId)}` : '';
  return apiFetch<SellerSettingsResponse>(`/api/marketplace/seller/settings${query}`, {
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}

interface StoreMutationResponse {
  success: boolean;
  error?: string;
  store?: { id: string };
}

/**
 * Enregistre l'onglet Boutique. Sans boutique (`storeId` vide/absent), la
 * route crée la première boutique de l'utilisateur (comme le bouton
 * Enregistrer du web quand `currentStoreId` est vide).
 */
export async function updateSellerStoreSettings(
  storeId: string | null,
  settings: StoreSettings,
): Promise<StoreMutationResponse> {
  return apiFetch<StoreMutationResponse>('/api/marketplace/seller/settings/update', {
    method: 'POST',
    body: JSON.stringify({ storeId: storeId || undefined, settings }),
    extraCookies: storeId ? [`currentStoreId=${storeId}`] : undefined,
  });
}

// ── Promos (coupons) ──────────────────────────────────────────────

export async function saveSellerCoupon(
  storeId: string,
  coupon: { code: string; discountPct: number; active: boolean },
): Promise<{ success: boolean; error?: string; coupon?: Coupon }> {
  return apiFetch('/api/marketplace/seller/settings/coupons', {
    method: 'POST',
    body: JSON.stringify({ action: 'save', storeId, coupon }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

export async function deleteSellerCoupon(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/settings/coupons', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id }),
  });
}

export async function toggleSellerCoupon(
  id: string,
  active: boolean,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/settings/coupons', {
    method: 'POST',
    body: JSON.stringify({ action: 'toggle', id, active }),
  });
}

// ── Équipe (staff) ────────────────────────────────────────────────

export async function addSellerStaff(
  storeId: string,
  staff: { email: string; role: string },
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/settings/staff', {
    method: 'POST',
    body: JSON.stringify({ action: 'add', storeId, staff }),
    extraCookies: [`currentStoreId=${storeId}`],
  });
}

export async function deleteSellerStaff(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/settings/staff', {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', id }),
  });
}

// ── Profil ────────────────────────────────────────────────────────

/** Met à jour le nom/photo de l'utilisateur connecté (data-URI accepté). */
export async function updateSellerProfile(payload: {
  fullName: string;
  avatarUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/settings/profile', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
