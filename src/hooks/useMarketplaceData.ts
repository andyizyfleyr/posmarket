'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { Coupon } from '@/types';
import {
  fetchProductReviewsAction,
  fetchStoreReviewsAction,
} from '@/app/actions/marketplace';

export interface MarketplaceReview {
  id: string;
  author: string;
  /** Photo de l'auteur (R2) ; absent pour un avis anonyme. */
  avatarUrl?: string | null;
  rating: number;
  comment: string;
  date: string;
  productId?: string;
  storeId?: string;
  productName?: string;
  productImage?: string;
}

const fetchActiveCoupons = async (storeIds: string[]): Promise<Coupon[]> => {
  if (!storeIds || storeIds.length === 0) return [];
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('active', true)
    .in('store_id', storeIds);
  if (error) throw error;
  return (data || []) as unknown as Coupon[];
};

export function useCoupons(storeIds: string[]) {
  const key = useMemo(() => [...storeIds].sort().join('|'), [storeIds]);
  return useQuery({
    queryKey: ['marketplace-coupons', key],
    enabled: key.length > 0,
    queryFn: () => fetchActiveCoupons(storeIds),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useStoreReviews(storeId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['store-reviews', storeId],
    enabled: !!storeId && enabled,
    queryFn: async (): Promise<MarketplaceReview[]> => {
      const res = await fetchStoreReviewsAction(storeId!);
      if (!res?.success) throw new Error(res?.error || 'Erreur lors du chargement des avis');
      return res.reviews as MarketplaceReview[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}

export function useProductReviews(productId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['product-reviews', productId],
    enabled: !!productId && enabled,
    queryFn: async (): Promise<MarketplaceReview[]> => {
      const res = await fetchProductReviewsAction(productId!);
      if (!res?.success) throw new Error(res?.error || 'Erreur lors du chargement des avis');
      return res.reviews as MarketplaceReview[];
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
