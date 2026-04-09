'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/supabase';
import { StoreData, Product, Customer, Order, Invoice, UserSubscription, Staff } from '@/types';

const CACHE_PREFIX = 'pos_cache_';

const cacheService = {
  get<T>(key: string, userId?: string): T | null {
    if (!userId) return null;
    try {
      const item = localStorage.getItem(`${CACHE_PREFIX}${userId}_${key}`);
      if (!item) return null;
      const { data, timestamp } = JSON.parse(item);
      if (Date.now() - timestamp > 24 * 60 * 60 * 1000) {
        localStorage.removeItem(`${CACHE_PREFIX}${userId}_${key}`);
        return null;
      }
      return data as T;
    } catch { return null; }
  },
  set<T>(key: string, data: T, userId?: string): void {
    if (!userId) return;
    try {
      localStorage.setItem(`${CACHE_PREFIX}${userId}_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (e) { console.warn('[Cache] Failed to save:', key); }
  },
  clear(userId: string): void {
    if (!userId) return;
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`${CACHE_PREFIX}${userId}_`)) {
        localStorage.removeItem(key);
      }
    });
  }
};

/**
 * 🚀 useSupabaseData - Version "CA VA VOLER" (Stable + Loader Persistant)
 */
export const useSupabaseData = (session: any, activeStoreId?: string) => {
    const [stores, setStores] = useState<StoreData[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const storesRef = useRef<StoreData[]>([]);
    useEffect(() => { storesRef.current = stores; }, [stores]);

    // ⚡ Initial cache load
    useEffect(() => {
        const userId = session?.user?.id;
        if (!userId) {
            setStores([]);
            setLoading(false);
            return;
        }

        const cached = cacheService.get<StoreData[]>('stores', userId);
        if (cached) { 
            setStores(cached); 
            setLoading(true); 
            setHasLoadedOnce(true); 
        } else {
            // Reset state if no cache for this user
            setStores([]);
            setLoading(true);
            setHasLoadedOnce(false);
        }
    }, [session?.user?.id]);

    // ⚡ Synchronisation COMPLETE d'une boutique
    const syncActiveStore = useCallback(async (storeId: string) => {
        if (!storeId) return;
        setIsSyncing(true);
        try {
            const [productsRes, ordersRes, staffRes, invoicesRes, customersRes, statsRes] = await Promise.all([
                supabase.from('products').select('*').eq('store_id', storeId).limit(150),
                supabase.from('orders').select('*').eq('store_id', storeId).order('date', { ascending: false }).limit(100),
                supabase.from('store_staff').select('*').eq('store_id', storeId),
                supabase.from('invoices').select('*').eq('store_id', storeId).order('date', { ascending: false }).limit(100),
                supabase.from('customers').select('*').eq('store_id', storeId).limit(100),
                supabase.from('product_stats').select('*').eq('store_id', storeId)
            ]);

            const targetStore = storesRef.current.find(s => s.id === storeId);
            let subscription = targetStore?.subscription;
            if (targetStore?.ownerId) {
                const { data: profile } = await supabase.from('profiles').select('*').eq('id', targetStore.ownerId).single();
                if (profile) {
                    subscription = {
                        tier: (profile.subscription_tier as any) || 'BASIC',
                        duration: (profile.subscription_duration as any) || 'monthly',
                        startDate: profile.subscription_start_date || new Date().toISOString(),
                        endDate: profile.subscription_end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                        status: (profile.subscription_status as any) || 'ACTIVE'
                    };
                }
            }

            const customersMap = Object.fromEntries((customersRes.data || []).map(c => [c.id, c]));
            const statsMap = Object.fromEntries((statsRes.data || []).map(s => [s.product_id, s]));

            const updatedStores = storesRef.current.map(s => s.id === storeId ? { 
                ...s, 
                subscription,
                products: (productsRes.data || []).map(p => ({
                    id: p.id, name: p.name, price: p.price, originalPrice: p.original_price, image: p.image,
                    images: p.images || [p.image], stock: p.stock || 0, category: p.category || '', mainCategory: p.main_category || '',
                    unit: p.unit || 'pièce', description: p.description || '', isOnline: p.is_online !== false, views: p.views || 0,
                    reviews: [], 
                    rating: statsMap[p.id] ? (parseFloat(statsMap[p.id].average_rating) || 0) : 0, 
                    reviewCount: statsMap[p.id] ? (parseInt(statsMap[p.id].review_count) || 0) : 0, 
                    salesCount: statsMap[p.id] ? (parseInt(statsMap[p.id].total_sales) || 0) : 0
                })),
                orders: (ordersRes.data || []).map(o => formatOrder(o, customersMap)),
                invoices: (invoicesRes.data || []).map(i => formatInvoice(i, customersMap)),
                customers: (customersRes.data || []).map(c => ({ 
                  id: c.id, name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', 
                  totalSpent: c.total_spent || 0, ordersCount: c.orders_count || 0 
                })),
                staff: (staffRes.data || []) as Staff[]
            } : s);

            setStores(updatedStores);
            cacheService.set('stores', updatedStores, session?.user?.id);
            // On libère le loader après la première synchro réussie de la boutique active
            setLoading(false);
        } catch (err) {
            console.error('Initial sync error:', err);
            setLoading(false);
        } finally { 
            setIsSyncing(false); 
        }
    }, []);

    // ⚡ 1. Fetch BASIC Stores List
    const fetchStores = useCallback(async () => {
        // On reste en loading
        setLoading(true);
        try {
            const { data: storesData } = await supabase.from('stores')
                .select('id, slug, user_id, name, email, phone, address, description, settings, ninea, views');
            
            if (!storesData || storesData.length === 0) {
                setStores([]);
                setLoading(false);
                setHasLoadedOnce(true);
                return;
            }

            const merged = storesData.map(s => {
                const existing = storesRef.current.find(ex => ex.id === s.id);
                return {
                    id: s.id, slug: s.slug, ownerId: s.user_id, views: s.views || 0,
                    address: s.address || (s.settings as any)?.address || '',
                    description: s.description || (s.settings as any)?.description || '',
                    settings: { 
                        name: s.name || (s.settings as any)?.name || '', 
                        email: s.email || (s.settings as any)?.email || '', 
                        phone: s.phone || (s.settings as any)?.phone || '', 
                        address: s.address || (s.settings as any)?.address || '', 
                        ninea: s.ninea || (s.settings as any)?.ninea || '', 
                        description: s.description || (s.settings as any)?.description || '' 
                    },
                    products: existing?.products || [], 
                    customers: existing?.customers || [], 
                    orders: existing?.orders || [], 
                    invoices: existing?.invoices || [], 
                    staff: existing?.staff || [],
                    subscription: existing?.subscription
                };
            });
            
            setStores(merged);
            setHasLoadedOnce(true);

            // Si on a déjà activeStoreId (passé par App.tsx), on synchronise immédiatement
            if (activeStoreId) {
                syncActiveStore(activeStoreId);
            } else {
                // Sinon, si on est au premier load, on sync la première boutique trouvée
                syncActiveStore(storesData[0].id);
            }
        } catch (err) {
            console.error('FetchStores error:', err);
            setLoading(false);
        }
    }, [activeStoreId, syncActiveStore]);

    // Initial trigger
    useEffect(() => {
        const timer = setTimeout(() => fetchStores(), 200);
        return () => clearTimeout(timer);
    }, [fetchStores]);

    // Sync switch store
    useEffect(() => {
        if (activeStoreId && hasLoadedOnce) {
            syncActiveStore(activeStoreId);
        }
    }, [activeStoreId, hasLoadedOnce, syncActiveStore]);

    return { 
        stores, setStores, loading, hasLoadedOnce, refetch: fetchStores, isSyncing, 
        actions: { 
            loadStoreOrders: syncActiveStore,
            loadStoreProducts: syncActiveStore,
            loadStoreCustomers: syncActiveStore,
            loadStoreInvoices: syncActiveStore
        } 
    };
};

const formatOrder = (o: any, customersMap: Record<string, any>) => ({
    id: o.id, date: o.date || new Date().toISOString(), items: [], subtotal: o.subtotal || 0, total: o.total || 0,
    discountAmount: o.discount_amount || 0, promoCode: o.promo_code || '', paymentMethod: o.payment_method || 'CASH',
    status: o.status || 'COMPLETED', type: o.type || 'IN_STORE', 
    customer: customersMap[o.customer_id] ? {
        id: customersMap[o.customer_id].id, name: customersMap[o.customer_id].name,
        email: customersMap[o.customer_id].email || '', phone: customersMap[o.customer_id].phone || '',
        address: customersMap[o.customer_id].address || '', totalSpent: customersMap[o.customer_id].total_spent || 0,
        ordersCount: customersMap[o.customer_id].orders_count || 0
    } : undefined
});

const formatInvoice = (inv: any, customersMap: Record<string, any>) => ({
    id: inv.id, invoiceNumber: inv.invoice_number || '', date: inv.date || new Date().toISOString(), dueDate: inv.due_date || '',
    customerName: inv.customer_name || '', customerEmail: inv.customer_email || '', customerAddress: inv.customer_address || '',
    items: [], subtotal: inv.subtotal || 0, total: inv.total || 0, status: inv.status || 'DRAFT', notes: inv.notes || '',
    customer: customersMap[inv.customer_id] ? {
        id: customersMap[inv.customer_id].id, name: customersMap[inv.customer_id].name,
        email: customersMap[inv.customer_id].email || '', phone: customersMap[inv.customer_id].phone || '',
        address: customersMap[inv.customer_id].address || '', totalSpent: customersMap[inv.customer_id].total_spent || 0,
        ordersCount: customersMap[inv.customer_id].orders_count || 0
    } : undefined
});

export const fetchProductReviews = async (productId: string) => {
    try {
        const { data, error } = await supabase.from('product_reviews').select('id, author_name, rating, comment, created_at').eq('product_id', productId).order('created_at', { ascending: false });
        if (!error && data) return data.map(r => ({ id: r.id, author: r.author_name || 'Anonyme', rating: r.rating || 5, comment: r.comment || '', date: r.created_at || new Date().toISOString() }));
        return [];
    } catch { return []; }
};

export const fetchOrderItems = async (orderId: string) => {
    try {
        const { data, error } = await supabase.from('order_items').select('id, product_id, quantity, price, check_in, check_out, guests, products!inner(id, name, image, price, unit)').eq('order_id', orderId);
        if (error) return [];
        return data?.map((i: any) => ({ 
            id: i.id, 
            product: { 
                id: i.products?.id, 
                name: i.products?.name || 'Produit supprimé', 
                image: i.products?.image || '', 
                price: i.products?.price || 0, 
                unit: i.products?.unit || 'pièce' 
            }, 
            quantity: i.quantity || 1,
            checkIn: i.check_in,
            checkOut: i.check_out,
            guests: i.guests
        })) || [];
    } catch { return []; }
};

export const fetchInvoiceItems = async (invoiceId: string) => {
    try {
        const { data, error } = await supabase.from('invoice_items').select('id, description, quantity, unit_price, total').eq('invoice_id', invoiceId);
        if (error) throw error;
        return data?.map(i => ({ description: i.description || '', quantity: i.quantity || 1, unitPrice: i.unit_price || 0, total: i.total || 0 })) || [];
    } catch { return []; }
};

export const fetchMarketplaceProducts = async (options: { 
    page?: number, 
    limit?: number, 
    storeId?: string, 
    category?: string, 
    search?: string 
}) => {
    const { page = 0, limit = 20, storeId, category, search } = options;
    const from = page * limit;
    const to = from + limit - 1;

    let query = supabase
        .from('products')
        .select(`
            id, name, price, original_price, image, images, stock, category, main_category, unit, description, is_online, views,
            stores!inner(id, name, slug, address)
        `, { count: 'exact' })
        .eq('is_online', true)
        .order('created_at', { ascending: false })
        .range(from, to);

    if (storeId) query = query.eq('store_id', storeId);
    
    if (category && category !== 'all') {
        query = query.or(`category.eq."${category}",main_category.eq."${category}"`);
    }
    
    if (search) {
        query = query.ilike('name', `%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) {
        console.error('fetchMarketplaceProducts Error:', error);
        return { products: [], total: 0 };
    }
    
    const products = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        originalPrice: p.original_price,
        image: p.image,
        images: p.images || [p.image],
        stock: p.stock || 0,
        category: p.category || '',
        mainCategory: p.main_category || '',
        unit: p.unit || 'pièce',
        description: p.description || '',
        isOnline: p.is_online !== false,
        views: p.views || 0,
        storeId: p.stores?.id,
        storeName: p.stores?.name,
        storeSlug: p.stores?.slug,
        storeCountry: p.stores?.address
    }));

    return { products, total: count || 0 };
};
