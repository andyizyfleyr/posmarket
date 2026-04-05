import { SupabaseClient } from '@supabase/supabase-js';
import { safeSupabaseFetch } from './supabase/retry';

export const FULL_PERMISSIONS = {
  canManageStores: true,
  canManageProducts: true,
  canManageInventory: true,
  canManageStaff: true,
  canViewReports: true,
  canManageOrders: true,
  canManageCustomers: true,
  canManageSettings: true,
  canManageInvoices: true
};

export const getPermissionsForUser = async (supabase: SupabaseClient, userId: string, storeId: string) => {
  // 1. Check if owner
  const { data: store } = await safeSupabaseFetch<any>(
    () => supabase.from('stores').select('user_id').eq('id', storeId).single()
  );
  
  const { data: profile } = await safeSupabaseFetch<any>(
    () => supabase.from('profiles').select('is_super_admin').eq('id', userId).single()
  );

  if (store?.user_id === userId || profile?.is_super_admin) {
    return { permissions: FULL_PERMISSIONS, role: 'OWNER' };
  }

  // 2. Check staff
  const { data: staff } = await safeSupabaseFetch<any>(
    () => supabase.from('store_staff')
      .select('role, permissions')
      .eq('store_id', storeId)
      .eq('user_id', userId)
      .single()
  );

  if (staff) {
    return { 
      permissions: staff.permissions || { ...FULL_PERMISSIONS, canViewReports: staff.role !== 'SELLER' }, 
      role: staff.role 
    };
  }

  return { permissions: {}, role: 'SELLER' };
};
