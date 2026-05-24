import { supabase } from '@/supabase';
import { Product, Customer, Order, StoreSettings, Invoice, Staff, UserProfile, UserSubscription } from '@/types';
import { generateSlug } from '@/utils';

export const saveProduct = async (product: Partial<Product>, storeId: string) => {
    const dataToSave: any = {
        store_id: storeId,
        name: product.name,
        price: product.price,
        original_price: product.originalPrice,
        image: product.image,
        stock: product.stock,
        category: product.category,
        main_category: product.mainCategory,
        unit: product.unit,
        description: product.description,
        amenities: product.amenities || [],
        max_guests: product.maxGuests,
        bedrooms: product.bedrooms,
        location: product.location,
        business_type: product.businessType || 'shopping',
        options: product.options || [],
        variants: product.variants || []
    };

    // Add images and is_online only if they are present in the product object
    if (product.images !== undefined) dataToSave.images = product.images;
    if (product.isOnline !== undefined) dataToSave.is_online = product.isOnline;

    // Clean dataToSave to remove any undefined fields that might cause SQL errors
    Object.keys(dataToSave).forEach(key => {
        if (dataToSave[key] === undefined) delete dataToSave[key];
    });

    if (product.id && !product.id.startsWith('temp-')) {
        const { data, error } = await supabase
            .from('products')
            .update(dataToSave)
            .eq('id', product.id)
            .select('id, name, price, stock, category, is_online')
            .single();
        if (error) throw error;
        return data;
    } else {
        const { data, error } = await supabase
            .from('products')
            .insert([dataToSave])
            .select('id, name, price, stock, category, is_online')
            .single();
        if (error) throw error;
        return data;
    }
};

export const deleteProduct = async (id: string) => {
    const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const saveCustomer = async (customer: Partial<Customer>, storeId: string) => {
    const dataToSave = {
        store_id: storeId,
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        total_spent: customer.totalSpent,
        orders_count: customer.ordersCount,
    };

    console.log(`[API] Saving customer in store ${storeId}...`, dataToSave);
    if (customer.id && !customer.id.startsWith('temp-')) {
        const { data, error } = await supabase
            .from('customers')
            .update(dataToSave)
            .eq('id', customer.id)
            .select()
            .single();
        if (error) {
            console.error('[API] Error updating customer:', error);
            throw error;
        }
        console.log('[API] Customer updated:', data.id);
        return data;
    } else {
        const { data, error } = await supabase
            .from('customers')
            .insert([dataToSave])
            .select()
            .single();
        if (error) {
            console.error('[API] Error inserting customer:', error);
            throw error;
        }
        console.log('[API] Customer created:', data.id);
        return data;
    }
};

export const deleteCustomer = async (id: string) => {
    const { error } = await supabase
        .from('customers')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const bulkDeleteCustomers = async (ids: string[]) => {
    const { error } = await supabase
        .from('customers')
        .delete()
        .in('id', ids);
    if (error) throw error;
};

export const createOrder = async (order: Order, storeId: string) => {
    const stayItems = order.items.filter(item => item.product.businessType === 'stay' && item.checkIn && item.checkOut);

    if (stayItems.length > 0) {
        const { data: results, error: checkError } = await supabase.rpc('check_availability_bulk', {
            p_requests: stayItems.map(item => ({
                product_id: item.product.id,
                check_in: item.checkIn,
                check_out: item.checkOut
            }))
        });

        if (checkError) throw checkError;
        
        const unavailable = results?.find((r: any) => !r.r_is_available);
        if (unavailable) {
            const pName = stayItems.find(i => i.product.id === unavailable.r_product_id)?.product.name;
            throw new Error(`Désolé, les dates pour "${pName}" ne sont plus disponibles.`);
        }
    }

    // 🚀 2. APPEL RPC GLOBAL (Architecture SaaS Pro-Grade)
    const idempotencyKey = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const { data: orderId, error: rpcError } = await supabase.rpc('create_order_full', {
        p_order: {
            store_id: storeId,
            customer_id: order.customer?.id,
            subtotal: order.subtotal || 0,
            total: order.total || 0,
            discount_amount: order.discountAmount || 0,
            promo_code: order.promoCode || null,
            payment_method: order.paymentMethod || 'ESPECES',
            status: order.status || 'PENDING',
            type: order.type || 'PICKUP',
            date: order.date || new Date().toISOString(),
            idempotency_key: idempotencyKey
        },
        p_items: order.items.map(item => ({
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.product.price,
            check_in: item.checkIn,
            check_out: item.checkOut,
            guests: item.guests
        }))
    });

    if (rpcError) throw rpcError;

    return { id: orderId };
};

export const searchProducts = async (query: string, storeId: string) => {
    const { data, error } = await supabase
        .from('products')
        .select('id, name, price, image, stock, category')
        .eq('store_id', storeId)
        .textSearch('search_vector', query, {
            type: 'websearch',
            config: 'french'
        });
    if (error) throw error;
    return data;
};

export const updateOrderStatus = async (orderId: string, status: string) => {
    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const bulkUpdateOrderStatus = async (orderIds: string[], status: string) => {
    const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .in('id', orderIds)
        .select();
    if (error) throw error;
    return data;
};

export const deleteOrder = async (id: string) => {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const bulkDeleteOrders = async (ids: string[]) => {
    const { error } = await supabase
        .from('orders')
        .delete()
        .in('id', ids);
    if (error) throw error;
};

export const addProductReview = async (storeId: string, productId: string, review: any) => {
    const dataToInsert: any = {
        store_id: storeId,
        product_id: productId,
        author_name: review.author || 'Anonyme',
        rating: review.rating,
        comment: review.comment
    };

    const { data, error } = await supabase
        .from('product_reviews')
        .insert(dataToInsert)
        .select()
        .single();

    if (error) {
        console.error('[API] Error adding review:', error);
        throw error;
    }
    return data;
};

export const updateStoreSettings = async (settings: StoreSettings, storeId: string) => {
    const { data, error } = await supabase
        .from('stores')
        .update({
            name: settings.name,
            slug: generateSlug(settings.name),
            email: settings.email,
            phone: settings.phone,
            address: settings.address,
            ninea: settings.ninea
        })
        .eq('id', storeId)
        .select()
        .single();

    if (error) throw error;
    return data;
};

export const saveInvoice = async (invoice: Invoice, storeId: string) => {
    const dataToSave = {
        store_id: storeId,
        invoice_number: invoice.invoiceNumber,
        customer_id: invoice.customer?.id,
        customer_name: invoice.customerName,
        customer_email: invoice.customerEmail,
        customer_address: invoice.customerAddress,
        subtotal: invoice.subtotal,
        total: invoice.total,
        status: invoice.status,
        notes: invoice.notes,
        date: invoice.date,
        due_date: invoice.dueDate,
    };

    let invId = invoice.id;

    if (invoice.id && !invoice.id.startsWith('temp-')) {
        const { error } = await supabase
            .from('invoices')
            .update(dataToSave)
            .eq('id', invoice.id);
        if (error) throw error;

        // Delete old items and re-insert
        await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
    } else {
        const { data, error } = await supabase
            .from('invoices')
            .insert([dataToSave])
            .select()
            .single();
        if (error) throw error;
        invId = data.id;
    }

    const invoiceItems = invoice.items.map(item => ({
        invoice_id: invId,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        total: item.total
    }));

    const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(invoiceItems);

    if (itemsError) throw itemsError;

    return invId;
};

export const deleteStore = async (id: string) => {
    const { error } = await supabase
        .from('stores')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

// Cache flags to prevent repeated 400 requests for missing columns
export const incrementProductViews = async (id: string) => {
    try {
        const { error } = await supabase.rpc('increment_product_views', { p_id: id });
        if (error) console.warn('[API] increment_product_views failed:', error.message);
    } catch (e) {
        console.error('[API] increment_product_views error:', e);
    }
};

export const incrementStoreViews = async (storeId: string) => {
    try {
        const { error } = await supabase.rpc('increment_store_views', { p_id: storeId });
        if (error) console.warn('[API] increment_store_views failed:', error.message);
    } catch (e) {
        console.error('[API] increment_store_views error:', e);
    }
};

export const getUserProfile = async (userId: string) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, is_super_admin, subscription_tier, subscription_status, subscription_end_date')
        .eq('id', userId)
        .single();
    if (error) throw error;

    return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        avatarUrl: data.avatar_url,
        isSuperAdmin: data.is_super_admin,
        subscriptionTier: data.subscription_tier || 'PRO',
        subscriptionStatus: data.subscription_status || 'ACTIVE',
        subscriptionEndDate: data.subscription_end_date
    };
};

export const updateUserProfile = async (userId: string, updates: { full_name?: string; avatar_url?: string }) => {
    const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();
    if (error) throw error;
    
    return {
        id: data.id,
        email: data.email,
        fullName: data.full_name,
        avatarUrl: data.avatar_url
    };
};

export const saveStaff = async (staff: any, storeId: string) => {
    // If we have an email and password, it means we are creating/linking a managed account
    if (staff.email && staff.password) {
        try {
            // Call the Edge Function to create the Auth User and link to store
            const { data, error: functionError } = await supabase.functions.invoke('create-staff', {
                body: {
                    email: staff.email,
                    password: staff.password,
                    role: staff.role,
                    storeId,
                    permissions: {} // Granular permissions removed
                }
            });

            if (functionError) {
                // If the error message is generic, try to get more from data
                const message = data?.error || functionError.message;

                // Handle already registered users
                if (message?.toLowerCase().includes('already registered')) {
                    const userId = await getProfileByEmail(staff.email);
                    if (userId) {
                        const { error } = await supabase
                            .from('store_staff')
                            .upsert({ store_id: storeId, user_id: userId, role: staff.role, permissions: {} });
                        if (error) throw error;
                        return;
                    }
                }
                throw new Error(message || "L'Edge Function a retourné une erreur (vérifiez vos logs Supabase).");
            }

            if (data?.error) throw new Error(data.error);
        } catch (error) {
            console.error('Staff creation error:', error);
            throw error;
        }
    } else {
        const { error } = await supabase
            .from('store_staff')
            .upsert({
                id: staff.id || undefined,
                store_id: storeId,
                user_id: staff.userId,
                role: staff.role,
                permissions: {}
            });

        if (error) throw error;
    }
};

export const getProfileByEmail = async (email: string) => {
    // We use the RPC function to bypass RLS restrictions for looking up user IDs by email
    const { data, error } = await supabase
        .rpc('get_user_id_by_email', { p_email: email });

    if (error) throw error;
    return data as string | null;
};

export const deleteStaff = async (id: string) => {
    const { error } = await supabase
        .from('store_staff')
        .delete()
        .eq('id', id);
    if (error) throw error;
};

export const updateSubscription = async (userId: string, subscription: UserSubscription) => {
    const { error } = await supabase
        .from('profiles')
        .update({
            subscription_tier: subscription.tier,
            subscription_duration: subscription.duration,
            subscription_start_date: subscription.startDate,
            subscription_end_date: subscription.endDate,
            subscription_status: subscription.status
        })
        .eq('id', userId);

    if (error) throw error;
};

// --- STAY / AIRBNB AVAILABILITY ENGINE ---

/**
 * Get availability for a specific listing within a date range
 */
export const getProductAvailability = async (productId: string, startDate: string, endDate: string) => {
    const { data, error } = await supabase
        .from('availability_slots')
        .select('*')
        .eq('product_id', productId)
        .gte('date', startDate)
        .lte('date', endDate);

    if (error) throw error;
    return data;
};

/**
 * Block dates for a listing (Hôte manual block or Booking)
 */
export const updateAvailability = async (productId: string, dates: string[], isAvailable: boolean, bookingId?: string) => {
    const records = dates.map(date => ({
        product_id: productId,
        date,
        is_available: isAvailable,
        booking_id: bookingId
    }));

    const { error } = await supabase
        .from('availability_slots')
        .upsert(records, { onConflict: 'product_id,date' });

    if (error) throw error;
};

/**
 * Check if a range of dates is fully available
 * Overlapping with any existing booking returns false
 */
export const checkDateRangeAvailable = async (productId: string, startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Handle same-day booking: check if that specific date is blocked
    if (startDate === endDate) {
        const { data, error } = await supabase
            .from('availability_slots')
            .select('date')
            .eq('product_id', productId)
            .eq('date', startDate)
            .eq('is_available', false)
            .limit(1);
        
        if (error) throw error;
        return data.length === 0;
    }
    
    // For multi-day bookings, we need to check for OVERLAP with existing bookings
    // A new booking [start, end] overlaps with existing if: start < existing_end AND end > existing_start
    
    // Get all blocked date ranges for this product
    const { data: blockedSlots, error } = await supabase
        .from('availability_slots')
        .select('date, booking_id')
        .eq('product_id', productId)
        .eq('is_available', false)
        .order('date');

    if (error) throw error;
    
    // Group consecutive blocked dates into ranges
    const blockedRanges: { start: string; end: string }[] = [];
    if (blockedSlots && blockedSlots.length > 0) {
        let rangeStart = blockedSlots[0].date;
        let rangeEnd = blockedSlots[0].date;
        
        for (let i = 1; i < blockedSlots.length; i++) {
            const currentDate = new Date(blockedSlots[i].date);
            const prevDate = new Date(blockedSlots[i - 1].date);
            const dayDiff = (currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24);
            
            if (dayDiff === 1) {
                // Consecutive, extend range
                rangeEnd = blockedSlots[i].date;
            } else {
                // Gap found, save previous range and start new
                blockedRanges.push({ start: rangeStart, end: rangeEnd });
                rangeStart = blockedSlots[i].date;
                rangeEnd = blockedSlots[i].date;
            }
        }
        // Push the last range
        blockedRanges.push({ start: rangeStart, end: rangeEnd });
    }
    
    // Check overlap with any blocked range (exact overlap only, no buffer)
    for (const range of blockedRanges) {
        const rangeStart = new Date(range.start);
        const rangeEnd = new Date(range.end);
        
        // Overlap: newStart < existingEnd AND newEnd > existingStart
        const overlaps = start < rangeEnd && end > rangeStart;
        
        if (overlaps) {
            return false;
        }
    }
    
    // No overlap found
    return true;
};

/**
 * Get directly unavailable dates (just the occupied dates, no buffer)
 */
export const getUnavailableDates = async (productId: string): Promise<string[]> => {
    const { data, error } = await supabase
        .from('availability_slots')
        .select('date')
        .eq('product_id', productId)
        .eq('is_available', false);

    if (error) throw error;
    return data ? data.map(d => d.date) : [];
};
