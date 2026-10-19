/**
 * Tableau de bord vendeur — écran mobile.
 *
 * Le parent web (`src/app/(app)/dashboard/page.tsx`) charge les commandes
 * (`loadOrdersForStore`), les produits et la boutique (`fetchStoreData`) côté
 * serveur, puis rend `DashboardView`. Ici la même route de données est appelée
 * via `fetchSellerDashboard`.
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSeller } from '@/context/SellerContext';
import { fetchSellerDashboard, type SellerOrder, type SellerStoreRow } from '@/api/seller';
import { SellerDashboardView } from '@/components/seller/DashboardView';
import { Loader } from '@/components/Loader';
import type { Product } from '@/types';

export default function SellerDashboardScreen() {
  const { currentStoreId, user, permissions, sessionExpired } = useSeller();
  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [store, setStore] = useState<SellerStoreRow | null>(null);
  const [loading, setLoading] = useState(true);
  /** Évite une double purge/toast si le contexte se met à jour avant le démontage. */
  const expiredRef = useRef(false);

  useEffect(() => {
    let active = true;
    expiredRef.current = false;
    (async () => {
      const res = await fetchSellerDashboard(currentStoreId).catch(() => null);
      if (!active) return;
      if (res?.success) {
        setOrders(res.orders || []);
        setProducts(res.products || []);
        setStore(res.store || null);
      } else if (res?.error === 'Unauthorized') {
        if (!expiredRef.current) {
          expiredRef.current = true;
          sessionExpired();
        }
        return;
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [currentStoreId, sessionExpired]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <Loader />
      </View>
    );
  }

  return (
    <SellerDashboardView
      orders={orders}
      products={products}
      store={store}
      userName={store?.name || user?.email?.split('@')[0]}
      userAvatarUrl={user?.avatarUrl}
      canViewReports={Boolean(permissions?.canViewReports)}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
});
