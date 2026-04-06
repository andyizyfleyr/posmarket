'use server'

import { createClient } from '@/utils/supabase/server'
import { StoreData, Product } from '@/types'
import { safeSupabaseFetch } from '@/utils/supabase/retry'
import { sendOrderNotification } from '@/utils/firebase-admin'

export async function fetchMarketplaceData() {
  const supabase = await createClient()

  // 1. Fetch BASIC Stores List
  const { data: storesData, error: storesError } = await safeSupabaseFetch<any[]>(
    () => supabase
      .from('stores')
      .select('id, slug, user_id, name, email, phone, address, ninea, views, description, settings, status')
      .or('status.eq.APPROVED,status.is.null')
  )

  // 2. Fetch all products
  const { data: productsData, error: productsError } = await safeSupabaseFetch<any[]>(
    () => supabase.from('products').select('*')
  )

  if (productsError) {
    console.error('Error fetching products:', productsError)
    return []
  }

  // 3. Fetch product stats
  const { data: productStatsData } = await safeSupabaseFetch<any[]>(
    () => supabase.from('product_stats').select('*')
  )

  const productStatsMap = Object.fromEntries(((productStatsData as any[]) || []).map((s: any) => [s.product_id, s]));

  // 3.1 Fetch store stats
  const { data: storeStatsData } = await safeSupabaseFetch<any[]>(
    () => supabase.from('store_stats').select('store_id, average_rating, total_reviews')
  )

  const storeStatsMap = Object.fromEntries(((storeStatsData as any[]) || []).map((s: any) => [s.store_id, s]));

  // 4. Merge exactly like the old project
  const marketplaceStores: StoreData[] = ((storesData as any[]) || []).map((s: any) => {
    const storeStats = storeStatsMap[s.id] || {};
    const settingsObj = s.settings || {};
    const description = s.description || settingsObj.description || '';
    
    return {
      id: s.id,
      slug: s.slug,
      ownerId: s.user_id,
      description: description,
      views: s.views || 0,
      rating: storeStats.average_rating ? parseFloat(storeStats.average_rating) : 0,
      reviewCount: storeStats.total_reviews ? parseInt(storeStats.total_reviews) : 0,
      settings: {
        name: s.name,
        email: s.email || '',
        phone: s.phone || '',
        address: s.address || '',
        ninea: s.ninea || '',
        description: description,
        ...settingsObj
      },
      products: ((productsData as any[]) || [])
        .filter((p: any) => p.store_id === s.id)
        .map((p: any) => {
          const stats = productStatsMap[p.id] || {};
          return {
            id: p.id,
            sku: p.sku,
            barcode: p.barcode,
            name: p.name,
            price: Number(p.price) || 0,
            originalPrice: p.original_price ? Number(p.original_price) : undefined,
            image: p.image,
            images: p.images || [p.image],
            stock: p.stock || 0,
            category: p.category || '',
            mainCategory: p.main_category || '',
            hasOptions: p.has_options,
            unit: p.unit || 'pièce',
            description: p.description || '',
            isOnline: p.is_online !== false, // matches p.isOnline !== false in StorefrontView
            views: p.views || 0,
            rating: stats.average_rating ? parseFloat(stats.average_rating) : 0,
            reviewCount: stats.review_count ? parseInt(stats.review_count) : 0,
            salesCount: stats.total_sales ? parseInt(stats.total_sales) : 0,
            wholesalePrice: p.wholesale_price ? parseFloat(p.wholesale_price) : undefined,
            wholesaleMinQty: p.wholesale_min_qty
          };
        }),
      customers: [],
      orders: [],
      invoices: [],
      staff: []
    } as any;
  })

  return marketplaceStores
}

export async function submitCheckoutAction(ordersData: Record<string, any>, customerData: any) {
  const supabase = await createClient()

  try {
    for (const storeId of Object.keys(ordersData)) {
      const storeOrderData = ordersData[storeId]

      // 1. Upsert Customer for this store
      // Try to find if customer exists by phone in this store
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('*')
        .eq('store_id', storeId)
        .eq('phone', customerData.phone)
        .maybeSingle()

      let customerId: string

      if (existingCustomer) {
        customerId = existingCustomer.id
        await supabase.from('customers').update({
          name: customerData.name || existingCustomer.name,
          total_spent: (existingCustomer.total_spent || 0) + storeOrderData.total,
          orders_count: (existingCustomer.orders_count || 0) + 1,
          address: customerData.address || existingCustomer.address
        }).eq('id', customerId)
      } else {
        const { data: newCustomer, error: custErr } = await supabase.from('customers').insert({
          store_id: storeId,
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address || '',
          total_spent: storeOrderData.total,
          orders_count: 1
        }).select().single()

        if (custErr) throw custErr
        customerId = newCustomer.id
      }

      // 2. Create Order
      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        store_id: storeId,
        customer_id: customerId,
        date: new Date().toISOString(),
        status: 'PENDING',
        type: 'PICKUP',
        payment_method: storeOrderData.paymentMethod || 'ESPECES',
        subtotal: storeOrderData.subtotal,
        tax: 0,
        total: storeOrderData.total,
        discount_amount: storeOrderData.discountAmount || 0,
        promo_code: storeOrderData.promoCode
      }).select().single()

      if (orderErr) throw orderErr

      // 3. Create Order Items and Update Stock
      for (const item of storeOrderData.items) {
        // Insert items
        const { error: itemErr } = await supabase.from('order_items').insert({
          order_id: order.id,
          product_id: item.product.id,
          quantity: item.quantity,
          price: (item.product.wholesalePrice && item.product.wholesaleMinQty && item.quantity >= item.product.wholesaleMinQty) 
            ? item.product.wholesalePrice 
            : item.product.price
        });

        if (itemErr) throw itemErr;

        // Update product stock atomically via RPC
        const { error: stockErr } = await supabase.rpc('decrement_stock', {
          p_id: item.product.id,
          p_quantity: item.quantity
        });

        // Fallback to manual update if RPC fails (backward compatibility)
        if (stockErr) {
          console.warn('RPC decrement_stock failed, falling back to manual update:', stockErr.message);
          const { data: product } = await supabase.from('products').select('stock').eq('id', item.product.id).single();
          if (product) {
            await supabase.from('products').update({
              stock: Math.max(0, (product.stock || 0) - item.quantity)
            }).eq('id', item.product.id);
          }
        }
      }
        }
      }

      // 4. Send Push Notification to Seller
      try {
        const { data: store } = await supabase.from('stores').select('name').eq('id', storeId).maybeSingle();
        if (store) {
          await sendOrderNotification(store.name || 'Ma Boutique', storeOrderData.total);
        }
      } catch (err) {
        console.warn('Failed to send push notification:', err);
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Checkout error:', error)
    return { success: false, error: error.message }
  }
}

export async function saveProductReviewAction(storeId: string, productId: string, review: any) {
  const supabase = await createClient()

  try {
    const { error } = await supabase.from('product_reviews').insert({
      product_id: productId,
      store_id: storeId,
      author_name: review.author || 'Anonyme',
      rating: review.rating || 5,
      comment: review.comment || '',
      created_at: new Date().toISOString()
    })

    if (error) throw error;

    return { success: true }
  } catch (error: any) {
    console.error('Review error:', error)
    return { success: false, error: error.message }
  }
}

export async function incrementProductViews(productId: string) {
  const supabase = await createClient()
  await supabase.rpc('increment_product_views', { p_id: productId })
}

export async function incrementStoreViews(storeId: string) {
  const supabase = await createClient()
  await supabase.rpc('increment_store_views', { p_id: storeId })
}
