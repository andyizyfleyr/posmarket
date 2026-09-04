'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { Coupon } from '@/types';

type ReviewRow = {
  id: string;
  author_name?: string | null;
  rating?: number | string | null;
  comment?: string | null;
  created_at?: string | null;
  product_id?: string | null;
  store_id?: string | null;
};

export interface MarketplaceReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
  productId?: string;
  storeId?: string;
}

const mapReview = (r: ReviewRow): MarketplaceReview => ({
  id: r.id,
  author: r.author_name || '',
  rating: typeof r.rating === 'number' ? r.rating : Number(r.rating) || 0,
  comment: r.comment || '',
  date: r.created_at || '',
  productId: r.product_id || undefined,
  storeId: r.store_id || undefined,
});

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
      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, author_name, rating, comment, created_at, product_id, store_id')
        .eq('store_id', storeId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => mapReview(r as unknown as ReviewRow));
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
      const { data, error } = await supabase
        .from('product_reviews')
        .select('id, author_name, rating, comment, created_at, product_id, store_id')
        .eq('product_id', productId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((r) => mapReview(r as unknown as ReviewRow));
    },
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });
}
