'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { StoreData, Staff } from '@/types';

/* =========================================================
   FORMATTERS (UI SAFE)
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

  customer: customersMap[o.customer_id]
    ? {
        id: customersMap[o.customer_id].id,
        name: customersMap[o.customer_id].name,
        email: customersMap[o.customer_id].email || '',
        phone: customersMap[o.customer_id].phone || '',
        address: customersMap[o.customer_id].address || '',
        totalSpent: customersMap[o.customer_id].total_spent || 0,
        ordersCount: customersMap[o.customer_id].orders_count || 0
      }
    : undefined
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

  customer: customersMap[inv.customer_id]
    ? {
        id: customersMap[inv.customer_id].id,
        name: customersMap[inv.customer_id].name,
        email: customersMap[inv.customer_id].email || '',
        phone: customersMap[inv.customer_id].phone || '',
        address: customersMap[inv.customer_id].address || '',
        totalSpent: customersMap[inv.customer_id].total_spent || 0,
        ordersCount: customersMap[inv.customer_id].orders_count || 0
      }
    : undefined
});

/* =========================================================
   FETCH STORE BUNDLE (CORE ENGINE)
========================================================= */

const fetchStoreBundle = async (storeId: string) => {
  const [productsRes, ordersRes, customersRes, invoicesRes, staffRes, statsRes] =
    await Promise.all([
      supabase
        .from('products')
        .select(
          'id, name, price, original_price, image, images, stock, category, main_category, unit, description, is_online, views, business_type, amenities, location, max_guests, bedrooms'
        )
        .eq('store_id', storeId)
        .limit(200),

      supabase
        .from('orders')
        .select(
          'id, customer_id, subtotal, total, discount_amount, promo_code, payment_method, status, type, date'
        )
        .eq('store_id', storeId)
        .order('date', { ascending: false })
        .limit(100),

      supabase
        .from('customers')
        .select(
          'id, name, email, phone, address, total_spent, orders_count'
        )
        .eq('store_id', storeId)
        .limit(200),

      supabase
        .from('invoices')
        .select(
          'id, invoice_number, customer_id, customer_name, customer_email, customer_address, subtotal, total, status, notes, date, due_date'
        )
        .eq('store_id', storeId)
        .limit(100),

      supabase
        .from('store_staff')
        .select('id, store_id, user_id, role, permissions')
        .eq('store_id', storeId),

      supabase
        .from('product_stats')
        .select('product_id, average_rating, review_count, total_sales')
        .eq('store_id', storeId)
    ]);

  const customersMap = Object.fromEntries(
    (customersRes.data || []).map((c) => [c.id, c])
  );

  const statsMap = Object.fromEntries(
    (statsRes.data || []).map((s) => [s.product_id, s])
  );

  return {
    products: (productsRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.original_price,
      image: p.image,
      images: p.images || [p.image],
      stock: p.stock,
      category: p.category,
      mainCategory: p.main_category,
      unit: p.unit,
      description: p.description,
      isOnline: p.is_online,
      views: p.views,
      businessType: p.business_type,
      amenities: p.amenities || [],
      location: p.location || '',
      maxGuests: p.max_guests,
      bedrooms: p.bedrooms,
      rating: statsMap[p.id]?.average_rating || 0,
      reviewCount: statsMap[p.id]?.review_count || 0,
      salesCount: statsMap[p.id]?.total_sales || 0
    })),

    orders: (ordersRes.data || []).map((o) => ({
      ...formatOrder(o, customersMap),
      items: [] // ✅ Obligatoire pour le type Order
    })),

    invoices: (invoicesRes.data || []).map((i) => ({
      ...formatInvoice(i, customersMap),
      items: [] // ✅ Obligatoire pour le type Invoice
    })),

    customers: (customersRes.data || []).map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      address: c.address,
      totalSpent: c.total_spent,
      ordersCount: c.orders_count
    })),

    staff: (staffRes.data || []).map((s: any) => ({
      id: s.id,
      storeId: s.store_id,
      userId: s.user_id,
      role: s.role,
      permissions: s.permissions || {}
    })) as Staff[]
  };
};

/* =========================================================
   MAIN HOOK
========================================================= */

export const useSupabaseData = (
  session: any,
  activeStoreId?: string
) => {
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  /* ---------------- STORES ---------------- */
  const storesQuery = useQuery({
    queryKey: ['stores', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select(
          'id, slug, user_id, name, email, phone, address, description, settings, ninea, views'
        );

      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5
  });

  /* ---------------- ACTIVE STORE BUNDLE ---------------- */
  const storeBundleQuery = useQuery({
    queryKey: ['store-bundle', activeStoreId],
    enabled: !!activeStoreId,

    queryFn: async () => {
      return await fetchStoreBundle(activeStoreId!);
    },

    staleTime: 1000 * 60 * 2
  });

  /* ---------------- MERGED STORES ---------------- */
  const stores = (storesQuery.data || []).map((s) => {
    if (s.id === activeStoreId && storeBundleQuery.data) {
      return {
        ...s,
        ...storeBundleQuery.data
      } as StoreData;
    }
    return s as StoreData;
  });

  /* ---------------- RETURN ---------------- */

  return {
    stores,
    activeStore: stores.find((s) => s.id === activeStoreId),

    loading:
      storesQuery.isLoading ||
      (!!activeStoreId && storeBundleQuery.isLoading && !storeBundleQuery.data),

    isSyncing: storeBundleQuery.isFetching,

    refetch: () => {
      storesQuery.refetch();
      if (activeStoreId) storeBundleQuery.refetch();
    }
  };
};

/* =========================================================
   ADDITIONAL EXPORTS (Used by Views - Build Fix)
========================================================= */

export const fetchOrderItems = async (orderId: string) => {
    const { data, error } = await supabase
        .from('order_items')
        .select('*, product:products(id, name, price, image)')
        .eq('order_id', orderId);
    if (error) throw error;
    return data;
};

export const fetchInvoiceItems = async (invoiceId: string) => {
    const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);
    if (error) throw error;
    return data;
};

export const fetchProductReviews = async (productId: string) => {
    const { data, error } = await supabase
        .from('product_reviews')
        .select('*, profiles(full_name, avatar_url)')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

export const fetchMarketplaceProducts = async () => {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, price, original_price, image, images, stock, category, main_category, unit, description, is_online, views, business_type, amenities, location, max_guests, bedrooms')
        .eq('is_online', true)
        .limit(50);
    if (error) throw error;
    return data.map((p: any) => ({
        ...p,
        originalPrice: p.original_price,
        mainCategory: p.main_category,
        isOnline: p.is_online,
        maxGuests: p.max_guests
    }));
};