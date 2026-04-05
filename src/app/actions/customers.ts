'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveCustomerAction(customer: any, storeId: string) {
    const supabase = await createClient()
    
    // Map camelCase to snake_case for Supabase
    const dbCustomer = {
        ...(customer.id && { id: customer.id }),
        store_id: storeId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        address: customer.address,
        total_spent: customer.totalSpent !== undefined ? customer.totalSpent : customer.total_spent,
        orders_count: customer.ordersCount !== undefined ? customer.ordersCount : customer.orders_count,
        last_order_date: customer.lastOrderDate || customer.last_order_date
    }
    
    const { data, error } = await supabase.from('customers').upsert(dbCustomer).select()
    
    if (error) {
        console.error('Error saving customer:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/customers')
    return { success: true, customer: data[0] }
}

export async function deleteCustomerAction(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('customers').delete().eq('id', id)
    
    if (error) {
        console.error('Error deleting customer:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/customers')
    return { success: true }
}

export async function bulkDeleteCustomersAction(ids: string[]) {
    const supabase = await createClient()
    const { error } = await supabase.from('customers').delete().in('id', ids)
    
    if (error) {
        console.error('Error bulk deleting customers:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/customers')
    return { success: true }
}

export async function getCustomersAction(storeId: string, offset: number = 0, limit: number = 10, search: string = '') {
    const supabase = await createClient()
    
    let query = supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .eq('store_id', storeId)
      .order('total_spent', { ascending: false })
      .range(offset, offset + limit - 1);
  
    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
  
    const { data, count, error } = await query;
  
    if (error) {
      console.error('Error fetching customers:', error);
      return { success: false, error: error.message };
    }
  
    return { 
      success: true, 
      customers: (data || []).map((c: any) => ({
        ...c,
        totalSpent: parseFloat(c.total_spent) || 0,
        ordersCount: Number(c.orders_count) || 0,
        lastOrderDate: c.last_order_date
      })), 
      hasMore: (count || 0) > (offset + (data?.length || 0)),
      total: count
    };
}
