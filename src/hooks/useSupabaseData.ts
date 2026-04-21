'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { StoreData, Product, Customer, Order, Invoice, Staff } from '@/types';

/* =========================================================
   CACHE LOCAL (fallback ultra rapide)
========================================================= */

const CACHE_PREFIX = 'pos_cache_v4_';

const cacheService = {
  get<T>(key: string, userId?: string): T | null {
    if (!userId || typeof window === 'undefined') return null;
    try {
      const item = localStorage.getItem(`${CACHE_PREFIX}${userId}_${key}`);
      if (!item) return null;
      const { data, timestamp } = JSON.parse(item);
      // 24h TTL
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`${CACHE_PREFIX}${userId}_${key}`);
        return null;
      }
      return data as T;
    } catch { return null; }
  },

  set<T>(key: string, data: T, userId?: string) {
    if (!userId || typeof window === 'undefined') return;
    try {
      localStorage.setItem(`${CACHE_PREFIX}${userId}_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
    } catch {}
  }
};

/* =========================================================
   FORMATTERS (UI SAFE & CONSISTENT)
========================================================= */

const formatOrder = (o: any, customersMap: Record<string, any>) => ({
  id: o.id,
  date: o.date,
  subtotal: o.subtotal || 0,
  total: o.total || 0,
  discountAmount: o.discount_amount || 0,
  promoCode: o.promo_code || '',
  paymentMethod: o.payment_method || 'CASH',
  status: o.status || 'PENDING',
  type: o.type || 'IN_STORE',
  customer: customersMap[o.customer_id] ? {
    id: customersMap[o.customer_id].id,
    name: customersMap[o.customer_id].name,
    email: customersMap[o.customer_id].email || '',
    phone: customersMap[o.customer_id].phone || '',
    address: customersMap[o.customer_id].address || '',
    totalSpent: customersMap[o.customer_id].total_spent || 0,
    ordersCount: customersMap[o.customer_id].orders_count || 0
  } : undefined
});

const formatInvoice = (inv: any, customersMap: Record<string, any>) => ({
  id: inv.id,
  invoiceNumber: inv.invoice_number,
  date: inv.date,
  dueDate: inv.due_date,
  customerName: inv.customer_name,
  customerEmail: inv.customer_email,
  customerAddress: inv.customer_address,
  subtotal: inv.subtotal || 0,
  total: inv.total || 0,
  status: inv.status || 'DRAFT',
  notes: inv.notes || '',
  customer: customersMap[inv.customer_id] ? {
    id: customersMap[inv.customer_id].id,
    name: customersMap[inv.customer_id].name,
    email: customersMap[inv.customer_id].email || '',
    phone: customersMap[inv.customer_id].phone || '',
    address: customersMap[inv.customer_id].address || '',
    totalSpent: customersMap[inv.customer_id].total_spent || 0,
    ordersCount: customersMap[inv.customer_id].orders_count || 0
  } : undefined
});

/* =========================================================
   FETCH FUNCTION (ULTRA OPTIMIZED)
========================================================= */

const fetchStoreBundle = async (storeId: string) => {
  const [productsRes, ordersRes, customersRes, invoicesRes, staffRes, statsRes] = await Promise.all([
    supabase.from('products')
      .select('id, name, price, original_price, image, images, stock, category, main_category, unit, description, is_online, views, business_type, amenities, location, max_guests, bedrooms')
      .eq('store_id', storeId).limit(200),
    supabase.from('orders')
      .select('id, customer_id, subtotal, total, discount_amount, promo_code, payment_method, status, type, date')
      .eq('store_id', storeId).order('date', { ascending: false }).limit(100),
    supabase.from('customers')
      .select('id, name, email, phone, address, total_spent, orders_count')
      .eq('store_id', storeId).limit(200),
    supabase.from('invoices')
      .select('id, invoice_number, customer_id, customer_name, customer_email, customer_address, subtotal, total, status, notes, date, due_date')
      .eq('store_id', storeId).limit(100),
    supabase.from('store_staff')
      .select('id, store_id, user_id, role, permissions')
      .eq('store_id', storeId),
    supabase.from('product_stats')
      .select('product_id, average_rating, review_count, total_sales')
      .eq('store_id', storeId)
  ]);

  const customersMap = Object.fromEntries((customersRes.data || []).map((c) => [c.id, c]));
  const statsMap = Object.fromEntries((statsRes.data || []).map((s) => [s.product_id, s]));

  return {
    products: (productsRes.data || []).map((p: any) => ({
      id: p.id, name: p.name, price: p.price, originalPrice: p.original_price,
      image: p.image, images: p.images || [p.image], stock: p.stock,
      category: p.category, mainCategory: p.main_category, unit: p.unit,
      description: p.description, isOnline: p.is_online, views: p.views,
      businessType: p.business_type, amenities: p.amenities || [],
      location: p.location || '', maxGuests: p.max_guests, bedrooms: p.bedrooms,
      rating: statsMap[p.id]?.average_rating || 0,
      reviewCount: statsMap[p.id]?.review_count || 0,
      salesCount: statsMap[p.id]?.total_sales || 0
    })),
    orders: (ordersRes.data || []).map((o) => formatOrder(o, customersMap)),
    invoices: (invoicesRes.data || []).map((i) => formatInvoice(i, customersMap)),
    customers: (customersRes.data || []).map((c) => ({
      id: c.id, name: c.name, email: c.email, phone: c.phone, address: c.address,
      totalSpent: c.total_spent, ordersCount: c.orders_count
    })),
    staff: (staffRes.data || []).map((s: any) => ({
      id: s.id, storeId: s.store_id, userId: s.user_id, role: s.role, permissions: s.permissions || {}
    })) as Staff[]
  };
};

/* =========================================================
   MAIN HOOK : useSupabaseData
========================================================= */

export const useSupabaseData = (session: any, activeStoreId?: string) => {
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  // 1. Stores List Query
  const storesQuery = useQuery({
    queryKey: ['stores', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('stores')
        .select('id, slug, user_id, name, email, phone, address, description, settings, ninea, views');
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5
  });

  // 2. Active Store Data Query (Le bundle complet)
  const activeStoreQuery = useQuery({
    queryKey: ['store-bundle', activeStoreId],
    enabled: !!activeStoreId,
    queryFn: async () => {
      // Priorité au cache pour l'instantanéité
      const cached = cacheService.get<any>(`bundle_${activeStoreId}`, userId);
      
      // On lance le fetch en tâche de fond (ou direct si pas de cache)
      const bundle = await fetchStoreBundle(activeStoreId!);
      cacheService.set(`bundle_${activeStoreId}`, bundle, userId);
      
      return bundle;
    },
    staleTime: 1000 * 60 * 2, // 2 min avant de considérer comme "vieux"
  });

  const stores = (storesQuery.data || []).map(s => {
    if (s.id === activeStoreId && activeStoreQuery.data) {
      return { ...s, ...activeStoreQuery.data };
    }
    return s;
  }) as StoreData[];

  return {
    stores,
    activeStore: stores.find(s => s.id === activeStoreId),
    loading: storesQuery.isLoading || (activeStoreId && activeStoreQuery.isLoading && !activeStoreQuery.data),
    isSyncing: activeStoreQuery.isFetching,
    refetch: () => {
        storesQuery.refetch();
        if (activeStoreId) activeStoreQuery.refetch();
    }
  };
};
