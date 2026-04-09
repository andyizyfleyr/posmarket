'use server'

import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/utils/supabase/server'
import { StoreData, Product } from '@/types'
import { safeSupabaseFetch } from '@/utils/supabase/retry'
import { sendOrderNotification, sendPushNotification } from '@/utils/firebase-admin'

export async function fetchMarketplaceData() {
  const supabase = await createClient();

  // 1-4. Fetch all essential data in PARALLEL to reduce latency

  const [storesRes, productsRes, productStatsRes, storeStatsRes, availabilitySlotsRes] = await Promise.all([
    safeSupabaseFetch<any[]>(() => 
      supabase
        .from('stores')
        .select('id, slug, user_id, name, email, phone, address, ninea, views, description, settings, status')
        .or('status.eq.APPROVED,status.is.null')),
    safeSupabaseFetch<any[]>(() => 
      supabase.from('products').select('*').eq('is_online', true)), // Only fetch online products for the marketplace
    safeSupabaseFetch<any[]>(() => 
      supabase.from('product_stats').select('*')),
    safeSupabaseFetch<any[]>(() => 
      supabase.from('store_stats').select('store_id, average_rating, total_reviews')),
    safeSupabaseFetch<any[]>(() => 
      supabase.from('availability_slots').select('*').gte('date', new Date().toISOString().split('T')[0]))
  ]);

  const storesData = storesRes.data || [];
  const productsData = productsRes.data || [];
  const productStatsData = productStatsRes.data || [];
  const storeStatsData = storeStatsRes.data || [];
  const slotsData = availabilitySlotsRes?.data || [];

  const productStatsMap = Object.fromEntries(productStatsData.map((s: any) => [s.product_id, s]));
  const storeStatsMap = Object.fromEntries(storeStatsData.map((s: any) => [s.store_id, s]));


  const productsByStoreMap: Record<string, any[]> = {};
  productsData.forEach((p: any) => {
    if (!productsByStoreMap[p.store_id]) productsByStoreMap[p.store_id] = [];
    productsByStoreMap[p.store_id].push(p);
  });

  // 4. Merge exactly like the old project
  const marketplaceStores: StoreData[] = storesData.map((s: any) => {
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
      products: (productsByStoreMap[s.id] || [])
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
            wholesaleMinQty: p.wholesale_min_qty,
            businessType: p.business_type,
            amenities: p.amenities || [],
            location: p.location || '',
            maxGuests: p.max_guests,
            bedrooms: p.bedrooms,
            currentBooking: (() => {
              const todayStr = new Date().toISOString().split('T')[0];
              const pSlots = slotsData.filter((s: any) => s.product_id === p.id).sort((a: any, b: any) => a.date.localeCompare(b.date));
              const todaySlot = pSlots.find((s: any) => s.date === todayStr);

              if (todaySlot && !todaySlot.is_available) {
                let endDate = todayStr;
                const todayIdx = pSlots.indexOf(todaySlot);
                for (let i = todayIdx; i < pSlots.length; i++) {
                  if (!pSlots[i].is_available) endDate = pSlots[i].date;
                  else break;
                }
                return {
                  startDate: todaySlot.booking_id ? 'Occupe' : todayStr,
                  endDate,
                  isManualBlock: !todaySlot.booking_id
                };
              }
              return null;
            })()
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

      // 1. Get current buyer user if logged in
      const { data: { user: buyer } } = await supabase.auth.getUser();

      // 2. Create Order
      const { data: order, error: orderErr } = await supabase.from('orders').insert({
        store_id: storeId,
        customer_id: customerId,
        buyer_id: buyer?.id, // Link to the logged-in buyer user
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

        // 4. Update Stock (for physical products)
        const { error: stockErr } = await supabase.rpc('decrement_stock', {
          p_id: item.product.id,
          p_quantity: item.quantity
        });

        if (stockErr) {
          console.warn('RPC decrement_stock failed, falling back to manual update:', stockErr.message);
          const { data: product } = await supabase.from('products').select('stock').eq('id', item.product.id).single();
          if (product) {
            await supabase.from('products').update({
              stock: Math.max(0, (product.stock || 0) - item.quantity)
            }).eq('id', item.product.id);
          }
        }

        // 5. Handle Stay Bookings - Block availability slots in DB
        if (item.checkIn && item.checkOut) {
          try {
            const start = new Date(item.checkIn);
            const end = new Date(item.checkOut);
            const slotsToUpsert = [];
            
            // Loop through dates
            const current = new Date(start);
            while (current <= end) {
              slotsToUpsert.push({
                product_id: item.product.id,
                date: current.toISOString().split('T')[0],
                is_available: false,
                booking_id: order.id
              });
              current.setDate(current.getDate() + 1);
            }
            
            if (slotsToUpsert.length > 0) {
              await supabase
                .from('availability_slots')
                .upsert(slotsToUpsert, { onConflict: 'product_id,date' });
            }
          } catch (slotErr) {
            console.warn('Failed to block availability slots for booking:', slotErr);
          }
        }

        // 6. Check for Low Stock after order (for physical products)
        try {
          const { data: updatedProduct } = await supabase.from('products').select('name, stock, business_type').eq('id', item.product.id).single();
          if (updatedProduct && updatedProduct.business_type !== 'stay' && updatedProduct.stock <= 5) {
            await sendPushNotification(
              `store_${storeId}`,
              '⚠️ Alerte Stock Bas',
              `Le stock de "${updatedProduct.name}" est dangereusement bas (${updatedProduct.stock} restant).`,
              { type: 'LOW_STOCK', store_id: storeId, product_id: item.product.id }
            );
          }
        } catch (stockCheckErr) {
          console.warn('Low stock notification check failed', stockCheckErr);
        }
      }
    }

    return { success: true }
  } catch (error: any) {
    console.error('Checkout error:', error)
    return { success: false, error: error.message }
  }
}

export async function notifyPostCheckoutAction(ordersData: Record<string, any>) {
  const supabase = await createClient()
  try {
    for (const storeId of Object.keys(ordersData)) {
      const storeOrderData = ordersData[storeId]
      
      const { data: store } = await supabase.from('stores').select('name').eq('id', storeId).maybeSingle();
      if (store) {
        await sendOrderNotification(store.name || 'Ma Boutique', storeOrderData.total, storeId);
        
        // Milestones
        const { count } = await supabase.from('orders').select('*', { count: 'exact', head: true }).eq('store_id', storeId);
        if (count && count > 0 && (count % 10 === 0 || count === 1)) {
           await sendPushNotification(
             `store_${storeId}`, 
             '🏆 Record de Performance !', 
             `Félicitations ! Vous venez d'atteindre ${count} commandes au total sur votre boutique ${store.name}.`,
             { type: 'MILESTONE', store_id: storeId, milestone_count: count.toString() }
           );
        }
      }
    }
  } catch (err) {
    console.warn('Failed to send post-checkout notifications:', err);
  }
}

export async function saveProductReviewAction(storeId: string, productId: string, review: any) {
  const supabase = await createClient()

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Vous devez être connecté pour laisser un avis.' }
    }

    // --- PURCHASE VERIFICATION ---
    // Check if this user (buyer_id) has an order that includes this product
    const { data: userOrders, error: orderCheckErr } = await supabase
      .from('orders')
      .select('id, order_items!inner(product_id)')
      .eq('buyer_id', user.id)
      .eq('order_items.product_id', productId)
      .limit(1)
      .maybeSingle();

    if (orderCheckErr) {
      console.error('Error checking user purchase history:', orderCheckErr);
      return { success: false, error: 'Impossible de vérifier votre historique d\'achat.' };
    }

    if (!userOrders) {
      return { success: false, error: 'Vous ne pouvez laisser un avis que sur les produits que vous avez achetés.' };
    }
    // --- END VERIFICATION ---

    const { error } = await supabase.from('product_reviews').insert({
      product_id: productId,
      store_id: storeId,
      user_id: user.id, // Securely use the authenticated user ID
      author_name: review.author || 'Anonyme',
      rating: review.rating || 5,
      comment: review.comment || '',
      created_at: new Date().toISOString()
    })

    if (error) throw error;

    // Send Notification for New Review
    try {
      const { data: store } = await supabase.from('stores').select('name').eq('id', storeId).maybeSingle();
      const { data: product } = await supabase.from('products').select('name').eq('id', productId).maybeSingle();
      if (store) {
        await sendPushNotification(
          `store_${storeId}`,
          '⭐️ Nouvel Avis Client',
          `Un avis a été laissé sur "${product?.name || 'votre produit'}" : "${review.comment?.substring(0, 50)}..."`,
          { type: 'NEW_REVIEW', store_id: storeId, product_id: productId }
        );
      }
    } catch (notifErr) {
      console.warn('New review notification failed', notifErr);
    }

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

export async function notifyCartInterestAction(storeId: string, productName: string) {
  try {
    const supabase = await createClient();
    const { data: store } = await supabase.from('stores').select('name').eq('id', storeId).maybeSingle();
    if (store) {
      await sendPushNotification(
        `store_${storeId}`,
        '🛒 Intérêt Panier !',
        `Quelqu'un regarde votre "[${productName}]" et vient de l'ajouter à son panier sur la marketplace !`,
        { type: 'CART_ALERT', store_id: storeId, product_name: productName }
      );
    }
    return { success: true }
  } catch (err) {
    console.error('Failed to send cart interest notification:', err);
    return { success: false }
  }
}

// --- BUYER SPACE ACTIONS ---

export async function fetchBuyerOrdersAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[DEBUG] fetchBuyerOrdersAction - User:', user?.id || 'NULL', 'Email:', user?.email || 'NULL');
  if (!user) return { success: false, error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      stores (name, address, phone),
      order_items!inner (*, products(name, image, price))
    `)
    .eq('buyer_id', user.id)
    .order('date', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, orders: data };
}

export async function fetchBuyerAddressesAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[DEBUG] fetchBuyerAddressesAction - User:', user?.id || 'NULL');
  if (!user) return { success: false, error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('buyer_addresses')
    .select('*')
    .eq('user_id', user.id)
    .order('is_default', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, addresses: data };
}

export async function saveBuyerAddressAction(formData: any) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const addressData = {
    user_id: user.id,
    name: formData.name,
    full_name: formData.fullName,
    phone: formData.phone,
    email: formData.email,
    address: formData.address,
    city: formData.city,
    is_default: formData.isDefault || false
  };

  if (formData.isDefault) {
    // Unset other defaults before setting this one
    await supabase.from('buyer_addresses').update({ is_default: false }).eq('user_id', user.id);
  }

  let result;
  if (formData.id) {
    result = await supabase.from('buyer_addresses').update(addressData).eq('id', formData.id);
  } else {
    result = await supabase.from('buyer_addresses').insert(addressData);
  }

  if (result.error) return { success: false, error: result.error.message };
  return { success: true };
}

export async function deleteBuyerAddressAction(addressId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  const { error } = await supabase.from('buyer_addresses').delete().eq('id', addressId).eq('user_id', user.id);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function fetchBuyerReviewsAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[DEBUG] fetchBuyerReviewsAction - User:', user?.id || 'NULL');
  if (!user) return { success: false, error: 'Unauthorized' };

  const { data, error } = await supabase
    .from('product_reviews')
    .select('*, products(name, image), stores(name)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, reviews: data };
}
