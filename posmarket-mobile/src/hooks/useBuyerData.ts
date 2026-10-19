/**
 * Données de l'espace acheteur — copie mobile de
 * `src/components/buyer/useBuyerData.ts` du web : cache local
 * `buyer_data_cache_v2` (avec propriétaire), rafraîchissement silencieux,
 * chargement progressif des commandes, enregistrement des adresses et des avis.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  deleteBuyerAddress,
  fetchBuyerAddresses,
  fetchBuyerOrders,
  fetchBuyerReviews,
  saveBuyerAddress,
  saveBuyerReview,
} from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import type { BuyerAddress, BuyerOrder, BuyerReview, BuyerTabId } from '@/types';
import type { SaveAddressPayload } from '@/components/buyer/AddressModal';

const CACHE_KEY = 'buyer_data_cache_v2';
const ORDER_PAGE_SIZE = 10;

interface BuyerCache {
  orders: BuyerOrder[];
  addresses: BuyerAddress[];
  reviews: BuyerReview[];
  totalOrders: number;
  /** Propriétaire du cache : évite de montrer les données d'un autre compte. */
  owner?: string;
  timestamp: number;
}

/** Au-delà de 30 jours, le cache est considéré dangereux et supprimé. */
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function readCache(owner?: string | null): Promise<BuyerCache | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuyerCache> | null;
    if (!parsed || !Array.isArray(parsed.orders)) return null;

    const writtenAt = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0;
    if (Date.now() - writtenAt > CACHE_MAX_AGE_MS) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return null;
    }
    if (parsed.owner && owner && parsed.owner !== owner) {
      await AsyncStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed as BuyerCache;
  } catch {
    return null;
  }
}

async function patchCache(patch: Partial<BuyerCache>, owner?: string | null) {
  try {
    const current =
      (await readCache(owner)) || {
        orders: [],
        addresses: [],
        reviews: [],
        totalOrders: 0,
        timestamp: 0,
      };
    await AsyncStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...current,
        owner: owner || current.owner,
        ...patch,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // stockage indisponible : on ignore silencieusement
  }
}

export function useBuyerData() {
  const { user, sessionExpired } = useAuth();
  const { notify } = useToast();
  /** Identité du compte : sert de propriétaire du cache local. */
  const owner = user?.id || user?.email || null;

  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [addresses, setAddresses] = useState<BuyerAddress[]>([]);
  const [reviews, setReviews] = useState<BuyerReview[]>([]);
  const [totalOrders, setTotalOrders] = useState(0);
  const [hasMoreOrders, setHasMoreOrders] = useState(false);
  const [orderPage, setOrderPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const stateRef = useRef({
    orders,
    addresses,
    reviews,
    totalOrders,
    hasMoreOrders,
    orderPage,
    loadingMore,
  });
  stateRef.current = {
    orders,
    addresses,
    reviews,
    totalOrders,
    hasMoreOrders,
    orderPage,
    loadingMore,
  };

  const handleSessionError = useCallback(
    (message?: string) => {
      if (message === 'Unauthorized') {
        sessionExpired();
        return true;
      }
      // Réponse obsolète (requête partie avant une connexion) : ignorée.
      if (message === 'UnauthorizedStale') return true;
      return false;
    },
    [sessionExpired],
  );

  const reloadTab = useCallback(
    async (tab: BuyerTabId) => {
      setError(null);
      if (tab === 'orders') {
        const res = await fetchBuyerOrders(1, ORDER_PAGE_SIZE);
        if (cancelledRef.current) return;
        if (res?.success) {
          const rows = res.orders || [];
          setOrders(rows);
          setTotalOrders(res.totalCount || 0);
          setHasMoreOrders(rows.length < (res.totalCount || 0));
          setOrderPage(1);
          void patchCache({ orders: rows, totalOrders: res.totalCount || 0 }, owner);
        } else if (!handleSessionError(res?.error)) {
          setError(res?.error || 'Impossible de charger vos commandes.');
        }
      } else if (tab === 'addresses') {
        const res = await fetchBuyerAddresses();
        if (cancelledRef.current) return;
        if (res?.success) {
          setAddresses(res.addresses || []);
          void patchCache({ addresses: res.addresses || [] }, owner);
        } else if (!handleSessionError(res?.error)) {
          setError(res?.error || 'Impossible de charger vos adresses.');
        }
      } else if (tab === 'reviews') {
        const res = await fetchBuyerReviews();
        if (cancelledRef.current) return;
        if (res?.success) {
          setReviews(res.reviews || []);
          void patchCache({ reviews: res.reviews || [] }, owner);
        } else if (!handleSessionError(res?.error)) {
          setError(res?.error || 'Impossible de charger vos avis.');
        }
      }
    },
    [handleSessionError, owner],
  );

  const refreshAll = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      await Promise.all([reloadTab('orders'), reloadTab('addresses'), reloadTab('reviews')]);
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [reloadTab]);

  // Montage : cache affiché instantanément puis rafraîchissement en arrière-plan.
  // Sans compte connecté, aucune requête n'est tentée : le serveur répondrait
  // « Unauthorized » et l'écran invité n'a de toute façon pas besoin de données.
  useEffect(() => {
    cancelledRef.current = false;
    if (!owner) {
      return () => {
        cancelledRef.current = true;
      };
    }
    let active = true;
    (async () => {
      const cache = await readCache(owner);
      if (!active) return;
      if (cache) {
        setOrders(cache.orders || []);
        setAddresses(cache.addresses || []);
        setReviews(cache.reviews || []);
        setTotalOrders(cache.totalOrders || 0);
        setHasMoreOrders((cache.orders?.length || 0) < (cache.totalOrders || 0));
        setLoading(false);
      }
      const isStale =
        !cache || !cache.timestamp || Date.now() - cache.timestamp > 20000;
      if (isStale) void refreshAll();
      else setLoading(false);
    })();
    return () => {
      active = false;
      cancelledRef.current = true;
    };
  }, [refreshAll, owner]);

  const loadMoreOrders = useCallback(async () => {
    const { loadingMore: busy, hasMoreOrders: more, orderPage: page, orders: current } =
      stateRef.current;
    if (busy || !more) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetchBuyerOrders(next, ORDER_PAGE_SIZE);
      if (cancelledRef.current) return;
      if (res?.success && Array.isArray(res.orders) && res.orders.length > 0) {
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const merged = [...prev, ...res.orders.filter((o) => !existingIds.has(o.id))];
          void patchCache({ orders: merged }, owner);
          return merged;
        });
        setOrderPage(next);
        setHasMoreOrders(current.length + res.orders.length < (res.totalCount || 0));
      } else {
        setHasMoreOrders(false);
      }
    } catch {
      notify('Impossible de charger plus de commandes.', 'error');
    } finally {
      if (!cancelledRef.current) setLoadingMore(false);
    }
  }, [notify, owner]);

  const handleSaveAddress = useCallback(
    async (addr: SaveAddressPayload) => {
      const res = await saveBuyerAddress({
        id: addr.id,
        name: addr.name,
        fullName: addr.fullName,
        phone: addr.phone,
        address: addr.address,
        city: addr.city,
        isDefault: addr.isDefault,
        userId: user?.id,
        email: user?.email,
      });
      if (res?.success) {
        notify('Adresse enregistrée avec succès', 'success');
        await reloadTab('addresses');
        return true;
      }
      if (!handleSessionError(res?.error)) {
        notify(res?.error || "Erreur lors de l'enregistrement de l'adresse.", 'error');
      }
      return false;
    },
    [handleSessionError, notify, reloadTab, user?.email, user?.id],
  );

  const handleDeleteAddress = useCallback(
    async (id: string) => {
      const res = await deleteBuyerAddress(id);
      if (res?.success) {
        notify('Adresse supprimée', 'info');
        await reloadTab('addresses');
        return true;
      }
      if (!handleSessionError(res?.error)) {
        notify(res?.error || "Erreur lors de la suppression de l'adresse.", 'error');
      }
      return false;
    },
    [handleSessionError, notify, reloadTab],
  );

  const submitReview = useCallback(
    async (
      storeId: string,
      productId: string,
      data: { rating: number; comment: string; author?: string },
    ) => {
      const res = await saveBuyerReview({ storeId, productId, ...data });
      if (res?.success) {
        notify('Avis publié avec succès', 'success');
        await reloadTab('reviews');
        return true;
      }
      if (!handleSessionError(res?.error)) {
        notify(res?.error || "Erreur lors de la publication de l'avis.", 'error');
      }
      return false;
    },
    [handleSessionError, notify, reloadTab],
  );

  return {
    orders,
    addresses,
    reviews,
    totalOrders,
    hasMoreOrders,
    loading,
    refreshing,
    loadingMore,
    error,
    refreshAll,
    reloadTab,
    loadMoreOrders,
    saveAddress: handleSaveAddress,
    deleteAddress: handleDeleteAddress,
    submitReview,
  };
}
