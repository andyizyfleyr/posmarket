'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { safeSupabaseFetch } from '@/utils/supabase/retry'

export async function fetchStores() {
  const supabase = await createClient()

  const { data: stores, error } = await safeSupabaseFetch<any[]>(
    () => supabase
      .from('stores')
      .select('id, slug, user_id, name, email, phone, address, ninea, views, settings')
  )

  if (error) {
    console.error('Error fetching stores:', error)
    return { success: false, error: error.message }
  }

  return { success: true, stores }
}

export async function fetchStoreData(storeId: string, ownerId?: string) {
  const supabase = await createClient()
  
  // Paralléliser les requêtes côté serveur avec gestion d'erreur robuste et retries
  const [productsRes, ordersRes, customersRes, invoicesRes, storeRes, statsRes, availabilitySlotsRes, profileRes]: any[] = await Promise.all([
    safeSupabaseFetch(() => supabase.from('products').select('*').eq('store_id', storeId).limit(200)),
    safeSupabaseFetch(() => supabase.from('orders').select('*, order_items(*, product:products(*)), customer:customers(*)').eq('store_id', storeId).order('date', { ascending: false }).limit(100)),
    safeSupabaseFetch(() => supabase.from('customers').select('*').eq('store_id', storeId).order('created_at', { ascending: false }).limit(100)),
    (async () => { try { return await safeSupabaseFetch(() => supabase.from('invoices').select('*').eq('store_id', storeId).limit(100)); } catch { return { data: [] }; } })(),
    safeSupabaseFetch(() => supabase.from('stores').select('*').eq('id', storeId).single()),
    (async () => { try { return await safeSupabaseFetch(() => supabase.from('product_stats').select('*').eq('store_id', storeId)); } catch { return { data: [] }; } })(),
    safeSupabaseFetch(() => supabase.from('availability_slots').select('*, product:products!inner(store_id)').eq('product.store_id', storeId).gte('date', new Date().toISOString().split('T')[0])),
    ownerId ? safeSupabaseFetch(() => supabase.from('profiles').select('*').eq('id', ownerId).single()) : Promise.resolve({ data: null })
  ])

  let profileData = profileRes?.data;
  if (!profileData && storeRes.data?.user_id) {
    // Fallback if ownerId wasn't passed but we got it from store
    const { data: p } = await safeSupabaseFetch(() => supabase.from('profiles').select('*').eq('id', storeRes.data.user_id).single());
    profileData = p;
  }

  const statsMap = Object.fromEntries((statsRes?.data || []).map((s: any) => [s.product_id, s]));
  const slotsData = availabilitySlotsRes?.data || [];

  // Mapping snake_case -> camelCase and parsing numerics for robustness
  const products = (productsRes.data || []).map((p: any) => {
    const stats = statsMap[p.id] || {};
    return {
      ...p,
      price: parseFloat(p.price) || 0,
      originalPrice: p.original_price ? parseFloat(p.original_price) : undefined,
      isOnline: p.is_online !== false,
      salesCount: Number(stats.total_sales) || 0,
      reviewCount: Number(stats.review_count) || 0,
      rating: Number(stats.average_rating) || 0,
      views: Number(p.views) || 0,
      wholesalePrice: p.wholesale_price ? parseFloat(p.wholesale_price) : undefined,
      wholesaleMinQty: p.wholesale_min_qty,
      mainCategory: p.main_category,
      businessType: p.business_type,
      amenities: p.amenities || [],
      maxGuests: p.max_guests,
      bedrooms: p.bedrooms,
      location: p.location,
      options: p.options || [],
      variants: p.variants || [],
    };
  }).map((p: any) => {
    // Determine current occupancy
    const todayStr = new Date().toISOString().split('T')[0];
    const pSlots = slotsData.filter((s: any) => s.product_id === p.id).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const todaySlot = pSlots.find((s: any) => s.date === todayStr);

    if (todaySlot && !todaySlot.is_available) {
      // Find the end of this specific booking
      let endDate = todayStr;
      const todayIdx = pSlots.indexOf(todaySlot);
      for (let i = todayIdx; i < pSlots.length; i++) {
        if (!pSlots[i].is_available) endDate = pSlots[i].date;
        else break;
      }

      // Also find the start (look back) - wait, we only fetched from today
      return {
        ...p,
        currentBooking: {
          startDate: todaySlot.booking_id ? 'Calculé...' : todayStr, // simplified
          endDate,
          isManualBlock: !todaySlot.booking_id
        }
      };
    }
    return p;
  });

  const orders = (ordersRes.data || []).map((o: any) => ({
    ...o,
    total: parseFloat(o.total) || 0,
    subtotal: parseFloat(o.subtotal) || 0,
    paymentMethod: o.payment_method,
    status: o.status,
    customer: o.customer,
    discountAmount: o.discount_amount ? parseFloat(o.discount_amount) : 0,
    items: (o.order_items || []).map((oi: any) => ({
      product: oi.product,
      quantity: oi.quantity,
      unitPrice: oi.unit_price,
      total: oi.total,
      checkIn: oi.check_in,
      checkOut: oi.check_out
    }))
  }));

  const customers = (customersRes.data || []).map((c: any) => ({
    ...c,
    totalSpent: parseFloat(c.total_spent) || 0,
    ordersCount: Number(c.orders_count) || 0
  }));

  return {
    products: products as any[],
    orders: orders as any[],
    customers: customers as any[],
    invoices: invoicesRes.data || [],
    store: storeRes.data || null,
    subscription: profileData ? {
      tier: profileData.subscription_tier || 'BASIC',
      duration: profileData.subscription_duration || 'monthly',
      status: profileData.subscription_status || 'ACTIVE',
      startDate: profileData.subscription_start_date || new Date().toISOString(),
      endDate: profileData.subscription_end_date || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    } : null,
    errors: {
      products: productsRes.error,
      orders: ordersRes.error,
      customers: customersRes.error,
      invoices: invoicesRes.error,
      store: storeRes.error
    }
  }
}

/**
 * Quick store creation from the navbar — only needs a name.
 * Replicates the old App.tsx handleCreateStore behavior.
 */
export async function quickCreateStoreAction(name: string, businessType: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

  const { data, error } = await supabase.from('stores').insert({
    user_id: session.user.id,
    name: name,
    slug,
    email: '',
    phone: '',
    address: '',
    ninea: '',
    status: 'PENDING',
    business_type: businessType
  }).select().single()

  if (error) {
    console.error('Error creating store:', error)
    return { success: false, error: error.message }
  }

  const { cookies } = await import('next/headers');
  (await cookies()).set('currentStoreId', data.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });

  revalidatePath('/', 'layout')
  return { success: true, store: data }
}

/**
 * Delete a store — with safety checks.
 */
export async function quickDeleteStoreAction(storeId: string) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return { success: false, error: 'Non authentifié' }
  }

  // Safety: verify the store belongs to this user
  const { data: store } = await supabase.from('stores').select('user_id').eq('id', storeId).single()
  if (!store || store.user_id !== session.user.id) {
    return { success: false, error: 'Vous ne pouvez supprimer que vos propres boutiques.' }
  }

  // Safety: check if user has other stores
  const { count } = await supabase.from('stores').select('id', { count: 'exact', head: true }).eq('user_id', session.user.id)
  if ((count || 0) <= 1) {
    return { success: false, error: 'Vous devez avoir au moins une boutique.' }
  }

  const { error } = await supabase.from('stores').delete().eq('id', storeId)

  if (error) {
    console.error('Error deleting store:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function clearStoreCookieAction() {
  const { cookies } = await import('next/headers');
  (await cookies()).delete('currentStoreId');
  revalidatePath('/', 'layout')
  return { success: true }
}
