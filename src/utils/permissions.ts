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

export const getPermissionsForUser = async (supabase: any, userId: string, storeId: string) => {
  const [storeRes, profileRes, staffRes] = await Promise.all([
    safeSupabaseFetch<any>(
      () => supabase.from('stores').select('user_id').eq('id', storeId).single()
    ),
    safeSupabaseFetch<any>(
      () => supabase.from('profiles').select('is_super_admin').eq('id', userId).single()
    ),
    safeSupabaseFetch<any>(
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
