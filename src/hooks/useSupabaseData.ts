'use client';

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/supabase';
import { StoreData, Staff } from '@/types';

/* =========================================================
   FORMATTERS (UI SAFE)
========================================================= */

type Row = Record<string, unknown>;

const formatOrder = (o: Row, customersMap: Record<string, Row>) => {
  const customer = o.customer_id ? customersMap[String(o.customer_id)] : undefined;
  return {
    id: o.id,
    date: o.date,
    subtotal: o.subtotal || 0,
    total: o.total || 0,
    discountAmount: o.discount_amount || 0,
    promoCode: o.promo_code || '',
    paymentMethod: o.payment_method || 'CASH',
    status: o.status || 'PENDING',
    type: o.type || 'IN_STORE',

    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          totalSpent: customer.total_spent || 0,
          ordersCount: customer.orders_count || 0
        }
      : undefined
  };
};

const formatInvoice = (inv: Row, customersMap: Record<string, Row>) => {
  const customer = inv.customer_id ? customersMap[String(inv.customer_id)] : undefined;
  return {
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

    customer: customer
      ? {
          id: customer.id,
          name: customer.name,
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
          totalSpent: customer.total_spent || 0,
          ordersCount: customer.orders_count || 0
        }
      : undefined
  };
};

/* =========================================================
   FETCH STORE BUNDLE (CORE ENGINE)
========================================================= */

const fetchStoreBundle = async (storeId: string) => {
  const [productsRes, ordersRes, customersRes, invoicesRes, staffRes, statsRes] =
    await Promise.all([
      supabase
        .from('products')
        .select(
          'id, name, price, original_price, image, images, stock, category, main_category, unit, description, is_online, views, business_type'
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
    (customersRes.data || []).map((c) => [String(c.id), c])
  );

  const statsMap = Object.fromEntries(
    (statsRes.data || []).map((s) => [String(s.product_id), s])
  );

  return {
    products: (productsRes.data || []).map((p) => ({
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
      rating: (statsMap[String(p.id)] as Record<string, unknown> | undefined)?.average_rating || 0,
      reviewCount: (statsMap[String(p.id)] as Record<string, unknown> | undefined)?.review_count || 0,
      salesCount: (statsMap[String(p.id)] as Record<string, unknown> | undefined)?.total_sales || 0
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

    staff: (staffRes.data || []).map((s) => ({
      id: s.id,
      storeId: s.store_id,
      userId: s.user_id,
      role: s.role,
      permissions: s.permissions || {}
    })) as unknown as Staff[]
  };
};

/* =========================================================
   MAIN HOOK
========================================================= */

export const useSupabaseData = (
  session: { user?: { id?: string | null } | null } | null | undefined,
  activeStoreId?: string
) => {
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
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  /* ---------------- ACTIVE STORE BUNDLE ---------------- */
  const storeBundleQuery = useQuery({
    queryKey: ['store-bundle', activeStoreId],
    enabled: !!activeStoreId,

    queryFn: async () => {
      return await fetchStoreBundle(activeStoreId!);
    },

    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 15,
  });

  /* ---------------- MERGED STORES ---------------- */
  const stores = (storesQuery.data || []).map((s) => {
    if (s.id === activeStoreId && storeBundleQuery.data) {
      return {
        ...s,
        ...storeBundleQuery.data
      } as unknown as StoreData;
    }
    return s as unknown as StoreData;
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
        .select('*')
        .eq('order_id', orderId);
    if (error) throw error;

    const productIds = [...new Set((data || []).map((i) => String(i.product_id || '')).filter(Boolean))];
    if (productIds.length === 0) return data || [];

    const { data: productsData } = await supabase
        .from('products')
        .select('id, name, price, image, business_type, main_category')
        .in('id', productIds);

    const productsMap = Object.fromEntries((productsData || []).map((p) => [String(p.id), p]));
    return (data || []).map((i) => ({ ...i, product: productsMap[String(i.product_id)] }));
};

export const fetchInvoiceItems = async (invoiceId: string): Promise<Record<string, unknown>[]> => {
    const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);
    if (error) throw error;
    return data;
};

export const fetchProductReviews = async (productId: string): Promise<Record<string, unknown>[]> => {
    const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
};

export const fetchMarketplaceProducts = async () => {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, price, original_price, image, images, stock, category, main_category, unit, description, is_online, views, business_type')
        .eq('is_online', true)
        .limit(50);
    if (error) throw error;
    return (data || []).map((p) => ({
        ...p,
        originalPrice: p.original_price,
        mainCategory: p.main_category,
        isOnline: p.is_online
    }));
};