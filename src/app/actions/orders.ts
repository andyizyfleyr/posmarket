'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function createOrderAction(order: any, storeId: string) {
    const supabase = await createClient()
    
    try {
        // 1. Map order to snake_case for Supabase
        const dbOrder = {
            store_id: storeId,
            customer_id: order.customer?.id,
            date: order.date || new Date().toISOString(),
            status: order.status || 'COMPLETED',
            type: order.type || 'IN_STORE',
            payment_method: order.paymentMethod || 'ESPECES',
            subtotal: order.subtotal,
            tax: 0,
            total: order.total,
            discount_amount: order.discountAmount || 0,
            promo_code: order.promoCode
        }
        
        const { data: orderData, error: orderErr } = await supabase.from('orders').insert(dbOrder).select().single()
        if (orderErr) throw orderErr
        
        // 2. Insert Order Items in bulk
        const orderItems = order.items.map((item: any) => ({
            order_id: orderData.id,
            product_id: item.product.id,
            quantity: item.quantity,
            price: item.product.price
        }));
        
        const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
        if (itemsErr) throw itemsErr;

        // 3. Update Product Sales Count (only for shopping - no stock for food/stay)
        for (const item of order.items) {
            if (!item.product.id) continue;
            
            const businessType = item.product.business_type || item.product.businessType;
            if (businessType !== 'shopping') continue;
            
            const { data: product } = await supabase.from('products').select('sales_count').eq('id', item.product.id).single()
            if (product) {
                await supabase.from('products').update({
                    sales_count: (product.sales_count || 0) + item.quantity
                }).eq('id', item.product.id)
            }
        }
        
        // 3. Update customer stats if applicable
        if (order.customer?.id) {
            const { data: customer } = await supabase.from('customers').select('total_spent, orders_count').eq('id', order.customer.id).single()
            if (customer) {
                await supabase.from('customers').update({
                    total_spent: (customer.total_spent || 0) + order.total,
                    orders_count: (customer.orders_count || 0) + 1,
                    last_order_date: new Date().toISOString()
                }).eq('id', order.customer.id)
            }
        }
        
        revalidatePath('/orders')
        revalidatePath('/pos')
        revalidatePath('/inventory')
        revalidatePath('/dashboard')
        
        return { success: true, order: orderData }
    } catch (error: any) {
        console.error('Order creation error:', error)
        return { success: false, error: error.message }
    }
}

export async function updateOrderStatusAction(orderId: string, status: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('orders').update({ status }).eq('id', orderId)
    
    if (error) {
        console.error('Error updating order status:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/orders')
    return { success: true }
}

export async function deleteOrderAction(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('orders').delete().eq('id', id)
    
    if (error) {
        console.error('Error deleting order:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/orders')
    return { success: true }
}

export async function bulkUpdateOrderStatusAction(orderIds: string[], status: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('orders').update({ status }).in('id', orderIds)
    
    if (error) {
        console.error('Error bulk updating order status:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/orders')
    return { success: true }
}

export async function bulkDeleteOrdersAction(orderIds: string[]) {
    const supabase = await createClient()
    const { error } = await supabase.from('orders').delete().in('id', orderIds)
    
    if (error) {
        console.error('Error bulk deleting orders:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/orders')
    return { success: true }
}

export async function getOrdersAction(storeId: string, offset: number = 0, limit: number = 10, search: string = '', status: string = 'ALL') {
    const supabase = await createClient()
    
    let query = supabase
      .from('orders')
      .select('*, customer:customers!inner(*), order_items(*, product:products(*))', { count: 'exact' })
      .eq('store_id', storeId)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);
  
    if (status !== 'ALL') {
      query = query.eq('status', status);
    }

    if (search) {
      if (search.startsWith('#')) {
        query = query.ilike('id', `%${search.slice(1)}%`);
      } else {
        // Now includes customer name in the search thanks to !inner join
        query = query.or(`id.ilike.%${search}%,status.ilike.%${search}%,customer.name.ilike.%${search}%`);
      }
    }
  
    const { data, count, error } = await query;
  
    if (error) {
      console.error('Error fetching orders:', error);
      return { success: false, error: error.message };
    }
  
    return { 
      success: true, 
      orders: (data || []).map((o: any) => ({
        ...o,
        total: Number(o.total) || 0,
        subtotal: Number(o.subtotal) || 0,
        discountAmount: Number(o.discount_amount) || 0,
        paymentMethod: o.payment_method,
        items: (o.order_items || []).map((oi: any) => ({
            ...oi,
            product: oi.product,
            checkIn: oi.check_in,
            checkOut: oi.check_out,
            guests: oi.guests
        }))
      })), 
      hasMore: (count || 0) > (offset + (data?.length || 0)),
      total: count
    };
}
