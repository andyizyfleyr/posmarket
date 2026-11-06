'use server';

import { revalidatePath } from 'next/cache';
import { requireStoreAccess } from '@/lib/authorization';
import {
  confirmStorePayment,
  getEnabledStorePaymentMethods,
  isStorePaymentProvider,
  listStorePaymentMethods,
  listStorePaymentsForOrders,
  saveStorePaymentMethod,
  type CheckoutPaymentMethod,
  type PublicStorePaymentConfig,
  type StorePaymentMethodView,
  type StorePaymentSecretPayload,
} from '@/lib/store-payments';

const MAX_STORES = 10;

/** Réglages complets d'une boutique (sans jamais renvoyer de secret). */
export async function fetchStorePaymentSettingsAction(
  storeId: string,
): Promise<{ success: boolean; methods?: StorePaymentMethodView[]; error?: string }> {
  try {
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { success: false, error: access.error };
    return { success: true, methods: await listStorePaymentMethods(storeId) };
  } catch (error) {
    console.error('[store-payments] load settings:', error);
    return { success: false, error: 'Impossible de charger les moyens de paiement.' };
  }
}

export async function saveStorePaymentMethodAction(
  storeId: string,
  provider: string,
  input: {
    enabled: boolean;
    config?: PublicStorePaymentConfig;
    secrets?: StorePaymentSecretPayload;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    const access = await requireStoreAccess(storeId);
    if (!access.ok) return { success: false, error: access.error };
    if (!isStorePaymentProvider(provider)) {
      return { success: false, error: 'Moyen de paiement inconnu.' };
    }
    const result = await saveStorePaymentMethod(storeId, provider, {
      enabled: Boolean(input?.enabled),
      config: input?.config,
      secrets: input?.secrets,
    });
    if (result.success) revalidatePath('/settings');
    return result;
  } catch (error) {
    console.error('[store-payments] save:', error);
    return { success: false, error: 'Impossible d’enregistrer ce moyen de paiement.' };
  }
}

/**
 * Méthodes activées par les boutiques du panier. Action publique : elle ne
 * renvoie que les clés publiques, codes USSD et instructions.
 */
export async function fetchStorePaymentMethodsAction(
  storeIds: string[],
): Promise<{ success: boolean; methods?: Record<string, CheckoutPaymentMethod[]>; error?: string }> {
  try {
    const ids = Array.isArray(storeIds)
      ? Array.from(new Set(storeIds.map((id) => String(id || '').trim()).filter(Boolean))).slice(
          0,
          MAX_STORES,
        )
      : [];
    if (ids.length === 0) return { success: true, methods: {} };
    return { success: true, methods: await getEnabledStorePaymentMethods(ids) };
  } catch (error) {
    console.error('[store-payments] public methods:', error);
    return { success: false, error: 'Impossible de charger les moyens de paiement.' };
  }
}

/** Confirmation après retour du widget Kkiapay / FedaPay. */
export async function confirmStorePaymentAction(
  orderId: string,
  token: string,
  reference?: string,
): Promise<{ success: boolean; status?: string; error?: string }> {
  try {
    const cleanOrderId = String(orderId || '').trim();
    const cleanToken = String(token || '').trim();
    if (!cleanOrderId || !cleanToken) {
      return { success: false, error: 'Paiement introuvable.' };
    }
    return await confirmStorePayment({
      orderId: cleanOrderId,
      token: cleanToken,
      reference: reference ? String(reference).trim().slice(0, 200) : undefined,
    });
  } catch (error) {
    console.error('[store-payments] confirm action:', error);
    return { success: false, error: 'La vérification du paiement a échoué.' };
  }
}

/** Vérification manuelle (SasPay, retour de guichet, paiement mobile). */
export async function refreshStorePaymentAction(
  orderId: string,
  token: string,
): Promise<{ success: boolean; status?: string; error?: string }> {
  return confirmStorePaymentAction(orderId, token);
}

export async function fetchOrderPaymentsAction(
  orderIds: string[],
): Promise<{ success: boolean; payments?: Array<{ id: string; orderId: string; status: string }> }> {
  try {
    const ids = Array.isArray(orderIds) ? orderIds.slice(0, 20) : [];
    const rows = await listStorePaymentsForOrders(ids);
    return {
      success: true,
      payments: rows.map((row) => ({ id: row.id, orderId: row.orderId, status: row.status })),
    };
  } catch {
    return { success: false };
  }
}
