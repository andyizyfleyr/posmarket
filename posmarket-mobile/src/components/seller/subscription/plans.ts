/**
 * Formules d'abonnement — copie de `SUBSCRIPTION_PLANS` / `getSubscriptionPlan`
 * (`src/constants.ts` du web).
 */

export type PlanTier = 'STARTER' | 'PRO' | 'ENTERPRISE';

export interface SubscriptionPlan {
  tier: PlanTier;
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

export const SUBSCRIPTION_PLANS: Record<PlanTier, SubscriptionPlan> = {
  STARTER: {
    tier: 'STARTER',
    name: 'Starter',
    description: 'Pour bien commencer.',
    priceMonthly: 12000,
    priceQuarterly: 32000,
    priceAnnual: 120000,
    features: {
      maxStores: 1,
      maxProducts: 50,
      enableStorefront: false,
      enableAdvancedReports: false,
      enableCustomReceipts: false,
    },
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
      enableStorefront: true,
      enableAdvancedReports: true,
      enableCustomReceipts: false,
    },
  },
  ENTERPRISE: {
    tier: 'ENTERPRISE',
    name: 'Entreprise',
    description: 'Solution complète sans limites.',
    priceMonthly: 20000,
    priceQuarterly: 55000,
    priceAnnual: 200000,
    features: {
      maxStores: 999,
      maxProducts: 999999,
      enableStorefront: true,
      enableAdvancedReports: true,
      enableCustomReceipts: true,
    },
  },
};

export function getSubscriptionPlan(
  tier: string | null | undefined,
): SubscriptionPlan | undefined {
  if (!tier) return undefined;
  if (tier === 'NONE' || tier === 'UNKNOWN') return undefined;
  return SUBSCRIPTION_PLANS[tier as PlanTier];
}
