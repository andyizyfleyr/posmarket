/**
 * Abonnement vendeur — écran mobile (route `/seller/subscription`).
 *
 * Toujours accessible (comme au web) : c'est l'écran proposé quand
 * l'abonnement est requis. L'état vient du bootstrap vendeur ; la vue
 * rafraîchit ce dernier après chaque mutation.
 */

import React from 'react';
import { useSeller } from '@/context/SellerContext';
import { SellerSubscriptionView } from '@/components/seller/SubscriptionView';

export default function SellerSubscriptionScreen() {
  const { subscription, role, refresh, sessionExpired } = useSeller();

  const snapshot = subscription || {
    tier: 'NONE',
    duration: 'monthly',
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    status: 'NONE',
  };

  return (
    <SellerSubscriptionView
      subscription={snapshot}
      userRole={role}
      onRefresh={refresh}
      onUnauthorized={sessionExpired}
    />
  );
}
