/**
 * Commandes vendeur — écran mobile (route `/seller/orders`).
 *
 * Le parent web (`src/app/(app)/orders/page.tsx`) charge la liste côté serveur
 * puis rend `OrdersView` ; ici la vue interroge elle-même la route
 * `/api/marketplace/seller/orders` (même pagination/recherche).
 */

import React from 'react';
import { useSeller } from '@/context/SellerContext';
import { SellerOrdersView } from '@/components/seller/OrdersView';

export default function SellerOrdersScreen() {
  const { currentStoreId, sessionExpired } = useSeller();

  if (!currentStoreId) return null;

  return <SellerOrdersView storeId={currentStoreId} onUnauthorized={sessionExpired} />;
}
