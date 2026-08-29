import { safeSupabaseFetch } from './supabase/retry';
import type { QueryBuilder } from '@/db/builder';

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

type SupabaseClientLike = { from: (table: string) => QueryBuilder };

export const getPermissionsForUser = async (supabase: SupabaseClientLike, userId: string, storeId: string) => {
  const [storeRes, profileRes, staffRes] = await Promise.all([
    safeSupabaseFetch<{ user_id: string }>(
      () => supabase.from('stores').select('user_id').eq('id', storeId).single()
    ),
    safeSupabaseFetch<{ is_super_admin: boolean }>(
      () => supabase.from('profiles').select('is_super_admin').eq('id', userId).single()
    ),
    safeSupabaseFetch<{ role: string; permissions: Record<string, boolean> | null }>(
      () => supabase.from('store_staff')
        .select('role, permissions')
        .eq('store_id', storeId)
        .eq('user_id', userId)
        .single()
    )
  ]);

  const { data: store } = storeRes;
  const { data: profile } = profileRes;
  const { data: staff } = staffRes;

  if (store?.user_id === userId || profile?.is_super_admin) {
    return { permissions: FULL_PERMISSIONS, role: 'OWNER' };
  }

  if (staff) {
    return { 
      permissions: staff.permissions || { ...FULL_PERMISSIONS, canViewReports: staff.role !== 'SELLER' }, 
      role: staff.role 
    };
  }

  return { permissions: {}, role: 'SELLER' };
};
