/**
 * Nouvelle boutique — écran mobile (route `/seller/new-store`).
 *
 * Rend le même écran que `src/app/(app)/new-store/page.tsx` du web
 * (`<NoStoreFound />`) ; la création sélectionne la boutique puis revient au
 * tableau de bord (équivalent de `window.location.href = '/dashboard'`).
 */

import React, { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useSeller } from '@/context/SellerContext';
import { SellerNoStore } from '@/components/seller/SellerNoStore';

export default function SellerNewStoreScreen() {
  const seller = useSeller();
  const router = useRouter();

  const handleCreate = useCallback(
    async (name: string, businessType: 'shopping' | 'food') => {
      const res = await seller.createStore(name, businessType);
      if (res.ok) {
        router.replace('/seller/dashboard');
      }
      return res;
    },
    [router, seller],
  );

  return <SellerNoStore onSubmit={handleCreate} />;
}
