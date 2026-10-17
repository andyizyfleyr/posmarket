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
  /**
   * Propriétaire du cache (id ou e-mail) : empêche d'afficher les commandes,
   * adresses ou avis d'un autre compte connecté sur le même appareil.
   */
  owner?: string;
  timestamp: number;
}

/**
 * Durée maximale de conservation du cache acheteur. Au-delà, l'entrée est
 * considérée comme dangereuse (commandes/avis obsolètes) et supprimée.
 */
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function readCache(owner?: string | null): BuyerCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuyerCache> | null;
    if (!parsed || !Array.isArray(parsed.orders)) return null;

    const writtenAt = typeof parsed.timestamp === 'number' ? parsed.timestamp : 0;
    if (Date.now() - writtenAt > CACHE_MAX_AGE_MS) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    // Cache d'un autre compte : on l'ignore au lieu de le montrer.
    if (parsed.owner && owner && parsed.owner !== owner) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }

    return parsed as BuyerCache;
  } catch {
    return null;
  }
}

function patchCache(patch: Partial<BuyerCache>, owner?: string | null) {
  if (typeof window === 'undefined') return;
  try {
    const current =
      readCache(owner) || { orders: [], addresses: [], reviews: [], totalOrders: 0, timestamp: 0 };
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        ...current,
        owner: owner || current.owner,
        ...patch,
        timestamp: Date.now(),
      }),
    );
  } catch {
    // stockage indisponible (quota / vie privée) : on ignore silencieusement
  }
}

export function useBuyerData(
  userOrNotify?: { id?: string; email?: string; name?: string } | null | NotifyFn,
  maybeNotify?: NotifyFn,
) {
  const user = typeof userOrNotify === 'object' ? userOrNotify : null;
  const notify = typeof userOrNotify === 'function' ? userOrNotify : maybeNotify;
  /** Identité du compte : sert de propriétaire du cache local. */
  const owner = user?.id || user?.email || null;

  const initialCache = typeof window !== 'undefined' ? readCache(owner) : null;

  const [orders, setOrders] = useState<BuyerOrder[]>(() => initialCache?.orders || []);
  const [addresses, setAddresses] = useState<BuyerAddress[]>(() => initialCache?.addresses || []);
  const [reviews, setReviews] = useState<BuyerReview[]>(() => initialCache?.reviews || []);
  const [totalOrders, setTotalOrders] = useState<number>(() => initialCache?.totalOrders || 0);
  const [hasMoreOrders, setHasMoreOrders] = useState<boolean>(() => {
    const c = initialCache;
    return c ? (c.orders?.length || 0) < (c.totalOrders || 0) : false;
  });
  const [orderPage, setOrderPage] = useState(1);
  const [loading, setLoading] = useState<boolean>(() => !initialCache);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelledRef = useRef(false);
  const notifyRef = useRef<NotifyFn | undefined>(notify);
  notifyRef.current = notify;
  const userRef = useRef(user);
  userRef.current = user;

  const getFallback = () => userRef.current?.id || userRef.current?.email;

  const applyOrders = useCallback((res: BuyerOrdersResponse, resetPage: boolean) => {
    if (res?.success) {
      const rows = res.orders || [];
      setOrders(rows);
      setTotalOrders(res.totalCount || 0);
      setHasMoreOrders(rows.length < (res.totalCount || 0));
      if (resetPage) setOrderPage(1);
      patchCache({ orders: rows, totalOrders: res.totalCount || 0 }, owner);
    } else if (res?.error === 'Unauthorized') {
      notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
    } else {
      setError(res?.error || 'Impossible de charger vos commandes.');
    }
  }, [owner]);

  const reloadTab = useCallback(
    async (tab: BuyerTabId) => {
      setError(null);
      const fallback = getFallback();
      if (tab === 'orders') {
        const res = await fetchBuyerOrdersAction(1, ORDER_PAGE_SIZE, fallback);
        if (cancelledRef.current) return;
        applyOrders(res, true);
      } else if (tab === 'addresses') {
        const res = await fetchBuyerAddressesAction(fallback);
        if (cancelledRef.current) return;
        if (res?.success && 'addresses' in res) {
          setAddresses(res.addresses || []);
          patchCache({ addresses: res.addresses || [] }, owner);
        } else if (res?.error === 'Unauthorized') {
          notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
        } else {
          setError(res?.error || 'Impossible de charger vos adresses.');
        }
      } else if (tab === 'reviews') {
        const res = await fetchBuyerReviewsAction(fallback);
        if (cancelledRef.current) return;
        if (res?.success && 'reviews' in res) {
          setReviews(res.reviews || []);
          patchCache({ reviews: res.reviews || [] }, owner);
        } else if (res?.error === 'Unauthorized') {
          notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
        } else {
          setError(res?.error || 'Impossible de charger vos avis.');
        }
      }
    },
    [applyOrders, owner],
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

  // Montage : affichage instantané du cache puis rafraîchissement silencieux en arrière-plan si expiré
  useEffect(() => {
    cancelledRef.current = false;
    const cache = readCache(owner);
    const isStale = !cache || !cache.timestamp || Date.now() - cache.timestamp > 20000;
    if (isStale) {
      refreshAll();
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [refreshAll, owner]);

  const loadMoreOrders = useCallback(async () => {
    if (loadingMore || !hasMoreOrders) return;
    setLoadingMore(true);
    try {
      const next = orderPage + 1;
      const res = await fetchBuyerOrdersAction(next, ORDER_PAGE_SIZE, getFallback());
      if (cancelledRef.current) return;
      if (res?.success && Array.isArray(res.orders) && res.orders.length > 0) {
        setOrders((prev) => {
          const existingIds = new Set(prev.map((o) => o.id));
          const merged = [...prev, ...res.orders.filter((o) => !existingIds.has(o.id))];
          patchCache({ orders: merged }, owner);
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
  }, [loadingMore, hasMoreOrders, orderPage, orders.length, owner]);

  const saveAddress = useCallback(
    async (addr: SaveAddressPayload) => {
      const payload: SaveAddressPayload = {
        ...addr,
        userId: addr.userId || userRef.current?.id,
        email: addr.email || userRef.current?.email,
      };
      const res = await saveBuyerAddressAction(payload);
      if (res?.success) {
        notifyRef.current?.('Adresse enregistrée avec succès', 'success');
        await reloadTab('addresses');
        return true;
      }
      if (res?.error === 'Unauthorized') {
        notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
      } else {
        notifyRef.current?.(res?.error || 'Erreur lors de l\'enregistrement de l\'adresse.', 'error');
      }
      return false;
    },
    [reloadTab],
  );

  const deleteAddress = useCallback(
    async (id: string) => {
      const res = await deleteBuyerAddressAction(id, getFallback());
      if (res?.success) {
        notifyRef.current?.('Adresse supprimée', 'info');
        await reloadTab('addresses');
        return true;
      }
      if (res?.error === 'Unauthorized') {
        notifyRef.current?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
      } else {
        notifyRef.current?.(res?.error || 'Erreur lors de la suppression de l\'adresse.', 'error');
      }
      return false;
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