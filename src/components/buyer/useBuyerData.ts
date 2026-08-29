'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchBuyerOrdersAction,
  fetchBuyerAddressesAction,
  saveBuyerAddressAction,
  deleteBuyerAddressAction,
  fetchBuyerReviewsAction,
  saveProductReviewAction,
} from '@/app/actions/marketplace';
import {
  BuyerAddress,
  BuyerOrder,
  BuyerOrdersResponse,
  BuyerReview,
  BuyerTabId,
  NotifyFn,
  SaveAddressPayload,
} from './accountTypes';

const CACHE_KEY = 'buyer_data_cache_v2';
const ORDER_PAGE_SIZE = 10;

interface BuyerCache {
  orders: BuyerOrder[];
  addresses: BuyerAddress[];
  reviews: BuyerReview[];
  totalOrders: number;
  timestamp: number;
}

function readCache(): BuyerCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.orders)) return null;
    return parsed as BuyerCache;
  } catch {
    return null;
  }
}

function patchCache(patch: Partial<BuyerCache>) {
  if (typeof window === 'undefined') return;
  try {
    const current =
      readCache() || { orders: [], addresses: [], reviews: [], totalOrders: 0, timestamp: 0 };
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ ...current, ...patch, timestamp: Date.now() }),
    );
  } catch {
    // stockage indisponible (quota / vie privée) : on ignore silencieusement
  }
}

export function useBuyerData(notify?: NotifyFn) {
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
  const notifyRef = useRef<NotifyFn | undefined>(notify);
  notifyRef.current = notify;

  const applyOrders = useCallback((res: BuyerOrdersResponse, resetPage: boolean) => {
    if (res?.success) {
      const rows = res.orders || [];
      setOrders(rows);
      setTotalOrders(res.totalCount || 0);
      setHasMoreOrders(rows.length < (res.totalCount || 0));
      if (resetPage) setOrderPage(1);
      patchCache({ orders: rows, totalOrders: res.totalCount || 0 });
    } else if (res?.error === 'Unauthorized') {
      notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
    } else {
      setError(res?.error || 'Impossible de charger vos commandes.');
    }
  }, []);

  const reloadTab = useCallback(
    async (tab: BuyerTabId) => {
      setError(null);
      if (tab === 'orders') {
        const res = await fetchBuyerOrdersAction(1, ORDER_PAGE_SIZE);
        if (cancelledRef.current) return;
        applyOrders(res, true);
      } else if (tab === 'addresses') {
        const res = await fetchBuyerAddressesAction();
        if (cancelledRef.current) return;
        if (res?.success && 'addresses' in res) {
          setAddresses(res.addresses || []);
          patchCache({ addresses: res.addresses || [] });
        } else if (res?.error === 'Unauthorized') {
          notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
        } else {
          setError(res?.error || 'Impossible de charger vos adresses.');
        }
      } else if (tab === 'reviews') {
        const res = await fetchBuyerReviewsAction();
        if (cancelledRef.current) return;
        if (res?.success && 'reviews' in res) {
          setReviews(res.reviews || []);
          patchCache({ reviews: res.reviews || [] });
        } else if (res?.error === 'Unauthorized') {
          notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
        } else {
          setError(res?.error || 'Impossible de charger vos avis.');
        }
      }
    },
    [applyOrders],
  );

  const refreshAll = useCallback(async () => {
    setError(null);
    setRefreshing(true);
    try {
      await Promise.all([
        reloadTab('orders'),
        reloadTab('addresses'),
        reloadTab('reviews'),
      ]);
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [reloadTab]);

  // Montage : affichage instantané du cache puis rafraîchissement en arrière-plan.
  useEffect(() => {
    cancelledRef.current = false;
    const cache = readCache();
    if (cache) {
      setOrders(cache.orders);
      setAddresses(cache.addresses);
      setReviews(cache.reviews);
      setTotalOrders(cache.totalOrders);
      setHasMoreOrders(cache.orders.length < (cache.totalOrders || 0));
      setLoading(false);
    }
    refreshAll();
    return () => {
      cancelledRef.current = true;
    };
  }, [refreshAll]);

  const loadMoreOrders = useCallback(async () => {
    if (loadingMore || !hasMoreOrders) return;
    setLoadingMore(true);
    try {
      const next = orderPage + 1;
      const res = await fetchBuyerOrdersAction(next, ORDER_PAGE_SIZE);
      if (cancelledRef.current) return;
      if (res?.success && Array.isArray(res.orders) && res.orders.length > 0) {
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const merged = [...prev, ...res.orders.filter((o) => !existingIds.has(o.id))];
          patchCache({ orders: merged });
          return merged;
        });
        setOrderPage(next);
        const known = orders.length + res.orders.length;
        setHasMoreOrders(known < (res.totalCount || 0));
      } else {
        setHasMoreOrders(false);
      }
    } catch {
      notifyRef.current?.('Impossible de charger plus de commandes.', 'error');
    } finally {
      if (!cancelledRef.current) setLoadingMore(false);
    }
  }, [loadingMore, hasMoreOrders, orderPage, orders.length]);

  const saveAddress = useCallback(
    async (addr: SaveAddressPayload) => {
      const res = await saveBuyerAddressAction(addr);
      if (res?.success) {
        notifyRef.current?.('Adresse enregistrée', 'success');
        await reloadTab('addresses');
        return true;
      }
      notifyRef.current?.(res?.error || 'Erreur lors de l\'enregistrement de l\'adresse.', 'error');
      return false;
    },
    [reloadTab],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      const res = await deleteBuyerAddressAction(id);
      if (res?.success) {
        notifyRef.current?.('Adresse supprimée', 'info');
        await reloadTab('addresses');
      } else {
        notifyRef.current?.(res?.error || 'Erreur lors de la suppression de l\'adresse.', 'error');
      }
    },
    [reloadTab],
  );

  const submitReview = useCallback(
    async (
      storeId: string,
      productId: string,
      data: { rating: number; comment: string; author?: string },
    ) => {
      const res = await saveProductReviewAction(storeId, productId, data);
      if (res?.success) {
        notifyRef.current?.('Avis publié avec succès', 'success');
        await reloadTab('reviews');
        return true;
      }
      notifyRef.current?.(res?.error || 'Erreur lors de la publication de l\'avis.', 'error');
      return false;
    },
    [reloadTab],
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
    saveAddress,
    deleteAddress,
    submitReview,
  };
}