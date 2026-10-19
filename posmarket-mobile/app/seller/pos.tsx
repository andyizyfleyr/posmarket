/**
 * Point de vente vendeur — écran mobile.
 *
 * Le parent web (`src/app/(app)/pos/page.tsx`) charge produits, clients et
 * boutique côté serveur puis rend `POSView` ; ici la même route de données est
 * appelée via `fetchSellerPos`, les codes promo via `fetchSellerPosCoupons` et
 * les compteurs de stock sont sondés toutes les 5 secondes, comme le web.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSeller } from '@/context/SellerContext';
import {
  fetchSellerPos,
  fetchSellerPosCoupons,
  fetchSellerPosStock,
  submitSellerPosOrder,
  type SellerCustomer,
  type SellerStoreRow,
} from '@/api/seller';
import { SellerPosView, type PosCheckoutInput } from '@/components/seller/POSView';
import { Loader } from '@/components/Loader';
import type { Coupon, Product, StoreSettings } from '@/types';

export default function SellerPosScreen() {
  const { currentStoreId, permissions, sessionExpired } = useSeller();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<SellerCustomer[]>([]);
  const [store, setStore] = useState<SellerStoreRow | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  /** Évite une double purge/toast si le contexte se met à jour avant le démontage. */
  const expiredRef = useRef(false);

  // Données du POS (produits, clients, boutique) + codes promo.
  useEffect(() => {
    if (!currentStoreId) return;
    let active = true;
    expiredRef.current = false;
    (async () => {
      const [pos, couponsRes] = await Promise.all([
        fetchSellerPos(currentStoreId).catch(() => null),
        fetchSellerPosCoupons(currentStoreId).catch(() => null),
      ]);
      if (!active) return;
      if (pos?.success) {
        setProducts(pos.products || []);
        setCustomers(pos.customers || []);
        setStore(pos.store || null);
      } else if (pos?.error === 'Unauthorized') {
        if (!expiredRef.current) {
          expiredRef.current = true;
          sessionExpired();
        }
        return;
      }
      if (couponsRes?.success) setCoupons(couponsRes.coupons || []);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [currentStoreId, sessionExpired]);

  const refreshStock = useCallback(async () => {
    if (!currentStoreId) return;
    const res = await fetchSellerPosStock(currentStoreId).catch(() => null);
    if (res?.success && res.stock) setStockMap(res.stock);
  }, [currentStoreId]);

  // Synchronisation du stock (badges des cartes produit) — toutes les 5 s.
  useEffect(() => {
    if (!currentStoreId) return;
    let active = true;
    const tick = async () => {
      const res = await fetchSellerPosStock(currentStoreId).catch(() => null);
      if (active && res?.success && res.stock) setStockMap(res.stock);
    };
    (async () => {
      await tick();
    })();
    const id = setInterval(() => {
      void tick();
    }, 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [currentStoreId]);

  /** Après une vente : stock live puis produits rechargés (équivaut à refreshStock + router.refresh). */
  const handleSold = useCallback(() => {
    void refreshStock();
    if (!currentStoreId) return;
    void (async () => {
      const res = await fetchSellerPos(currentStoreId).catch(() => null);
      if (res?.success) {
        setProducts(res.products || []);
        setCustomers(res.customers || []);
        setStore(res.store || null);
      }
    })();
  }, [currentStoreId, refreshStock]);

  const handleCheckout = useCallback(
    async (input: PosCheckoutInput) => {
      if (!currentStoreId) return { success: false, error: 'Boutique inconnue' };
      const res = await submitSellerPosOrder(currentStoreId, {
        ...input,
        date: new Date().toISOString(),
      }).catch(() => null);
      if (!res) return { success: false, error: 'Erreur de connexion serveur' };
      if (res.error === 'Unauthorized') {
        if (!expiredRef.current) {
          expiredRef.current = true;
          sessionExpired();
        }
        return { success: false, error: 'Session expirée, veuillez vous reconnecter.' };
      }
      return { success: res.success, orderId: res.order?.id, error: res.error };
    },
    [currentStoreId, sessionExpired],
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <Loader />
      </View>
    );
  }

  return (
    <SellerPosView
      products={products}
      customers={customers}
      storeSettings={(store?.settings || {}) as unknown as StoreSettings}
      canManageOrders={Boolean(permissions?.canManageOrders)}
      businessType={store?.business_type}
      stockMap={stockMap}
      coupons={coupons}
      onCheckout={handleCheckout}
      onSold={handleSold}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDFDFE',
  },
});
