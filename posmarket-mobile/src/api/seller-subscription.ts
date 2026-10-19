/**
 * Abonnement vendeur — appels API mobiles.
 *
 * Reprend `src/app/actions/subscription.ts` du web : la page abonnement du
 * mobile interroge la route `/api/marketplace/seller/subscription` (état,
 * configuration de paiement, création de facture, confirmation).
 */

import { apiFetch } from '@/api/client';

export type SubscriptionTier = 'NONE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
export type SubscriptionDuration = 'monthly' | 'quarterly' | 'annual';
export type PaymentProvider = 'kkiapay' | 'fedapay' | 'feexpay';

export interface SubscriptionSnapshot {
  tier: string;
  duration: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface SubscriptionPaymentConfig {
  success: boolean;
  error?: string;
  provider: PaymentProvider;
  kkiapayPublicKey: string;
  kkiapayEnv: 'sandbox' | 'live';
  fedapayPublicKey: string;
  fedapayEnv: 'sandbox' | 'live';
  feexpayShopId: string;
  feexpayApiKey: string;
  feexpayEnv: 'sandbox' | 'live';
  userName: string;
  userEmail: string;
  userPhone: string;
  subscription: SubscriptionSnapshot;
}

/** État de l'abonnement + configuration publique du paiement. */
export async function fetchSubscriptionPaymentConfig(): Promise<SubscriptionPaymentConfig> {
  return apiFetch<SubscriptionPaymentConfig>(
    '/api/marketplace/seller/subscription',
  );
}

export interface CreateSubscriptionPaymentResponse {
  success: boolean;
  error?: string;
  code?: string;
  transactionId?: string;
  amount?: number;
}

/** Facture PENDING (`createSubscriptionPaymentAction`). */
export async function createSubscriptionPayment(
  tier: SubscriptionTier,
  duration: SubscriptionDuration,
): Promise<CreateSubscriptionPaymentResponse> {
  return apiFetch<CreateSubscriptionPaymentResponse>(
    '/api/marketplace/seller/subscription',
    {
      method: 'POST',
      body: JSON.stringify({ action: 'create', tier, duration }),
    },
  );
}

export interface ConfirmSubscriptionPaymentResponse {
  success: boolean;
  error?: string;
  message?: string;
}

/** Vérification + activation (Kkiapay / FedaPay / FeexPay). */
export async function confirmSubscriptionPayment(
  transactionId: string,
  reference: string,
): Promise<ConfirmSubscriptionPaymentResponse> {
  return apiFetch<ConfirmSubscriptionPaymentResponse>(
    '/api/marketplace/seller/subscription',
    {
      method: 'POST',
      body: JSON.stringify({ action: 'confirm', transactionId, reference }),
    },
  );
}

/** Activation directe, sans paiement (`updateSubscriptionAction`). */
export async function updateSellerSubscription(
  tier: SubscriptionTier,
  duration: SubscriptionDuration,
): Promise<{ success: boolean; error?: string }> {
  return apiFetch('/api/marketplace/seller/subscription', {
    method: 'POST',
    body: JSON.stringify({ action: 'update', tier, duration }),
  });
}
