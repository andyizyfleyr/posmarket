/**
 * Rapports (Historique) vendeur — écran mobile (route `/seller/reports`).
 *
 * Le parent web (`src/app/(app)/reports/page.tsx`) charge les 100 dernières
 * commandes (`loadOrdersForStore`) et la boutique (`fetchStoreData`) côté
 * serveur puis rend `ReportsView` ; ici la même route de données est appelée
 * via `fetchSellerReports`. L'accès est réservé aux non-SELLER (garde du
 * layout, comme `MainLayout` au web).
 */

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSeller } from '@/context/SellerContext';
import {
  fetchSellerReports,
  type ReportsOrder,
  type ReportsStoreSettings,
} from '@/api/seller-reports';
import { SellerReportsView } from '@/components/seller/ReportsView';
import { Loader } from '@/components/Loader';

export default function SellerReportsScreen() {
  const { currentStoreId, sessionExpired } = useSeller();
  const [orders, setOrders] = useState<ReportsOrder[]>([]);
  const [storeSettings, setStoreSettings] = useState<ReportsStoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  /** Évite une double purge si le contexte se met à jour avant le démontage. */
  const expiredRef = useRef(false);

  useEffect(() => {
    let active = true;
    expiredRef.current = false;
    (async () => {
      const res = await fetchSellerReports(currentStoreId).catch(() => null);
      if (!active) return;
      if (res?.success) {
        setOrders(res.orders || []);
        setStoreSettings(res.store?.settings || null);
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

  return <SellerReportsView orders={orders} storeSettings={storeSettings} />;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
});
