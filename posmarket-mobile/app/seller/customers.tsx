/**
 * Clients vendeur — écran mobile (route `/seller/customers`).
 *
 * Le parent web (`src/app/(app)/customers/page.tsx`) charge la liste côté
 * serveur puis rend `CustomersView` ; ici la vue interroge la route
 * `/api/marketplace/seller/customers` (même pagination/recherche).
 */

import React from 'react';
import { useSeller } from '@/context/SellerContext';
import { SellerCustomersView } from '@/components/seller/CustomersView';

export default function SellerCustomersScreen() {
  const { currentStoreId, permissions, role, sessionExpired } = useSeller();

  if (!currentStoreId) return null;

  return (
    <SellerCustomersView
      storeId={currentStoreId}
      canManageCustomers={Boolean(permissions?.canManageCustomers)}
      isSeller={role === 'SELLER'}
      onUnauthorized={sessionExpired}
    />
  );
}
