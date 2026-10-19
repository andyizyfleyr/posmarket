/**
 * Stocks vendeur — écran mobile (route `/seller/inventory`).
 *
 * Le parent web (`src/app/(app)/inventory/page.tsx`) charge les données côté
 * serveur puis rend `InventoryView` ; ici la vue interroge la route
 * `/api/marketplace/seller/inventory` (mêmes filtres et pagination).
 */

import React, { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';
import { useSeller } from '@/context/SellerContext';
import { SellerInventoryView } from '@/components/seller/InventoryView';

export default function SellerInventoryScreen() {
  const { currentStoreId, currentStore, permissions, plan, sessionExpired } = useSeller();
  const router = useRouter();

  const openSubscription = useCallback(() => {
    // Cast temporaire : route créée juste après (même patron que _layout.tsx).
    router.push('/seller/subscription');
  }, [router]);

  if (!currentStoreId) return null;

  return (
    <SellerInventoryView
      storeId={currentStoreId}
      businessType={currentStore?.businessType === 'food' ? 'food' : 'shopping'}
      storeName={
        currentStore?.settings?.name || currentStore?.name || 'Boutique'
      }
      canManageInventory={Boolean(permissions?.canManageInventory)}
      maxProducts={Number(plan?.features?.maxProducts) || 6}
      onUnauthorized={sessionExpired}
      onDiscoverPlans={openSubscription}
    />
  );
}
