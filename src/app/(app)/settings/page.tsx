import SettingsView from '@/views/SettingsView';
import { fetchStoreData } from '@/app/actions/store';
import { updateStoreSettingsAction, createStoreAction, deleteStoreAction, saveCouponAction, deleteCouponAction } from '@/app/actions/settings';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser, FULL_PERMISSIONS } from '@/utils/permissions';
import { StoreSettings, StoreData } from '@/types';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  
  let currentStore: any = null;
  let products: any[] = [];
  let customers: any[] = [];
  let orders: any[] = [];
  let staff: any[] = [];
  let coupons: any[] = [];
  let stores: StoreData[] = [];
  let permissions = FULL_PERMISSIONS;
  let role = 'OWNER';

  // Fetch all stores owned by this user
  const { data: allStores } = await supabase.from('stores').select('*').eq('user_id', session.user.id);
  
  if (allStores) {
    stores = allStores.map(s => ({
        id: s.id,
        slug: s.slug || '',
        settings: s.settings || {},
        user_id: s.user_id,
        name: s.name
    }));
  }

  if (storeId) {
    const { data: storeRes } = await supabase.from('stores').select('*').eq('id', storeId).single();
    currentStore = storeRes;

    const data = await fetchStoreData(storeId);
    products = data.products;
    customers = data.customers;
    orders = data.orders;

    // Fetch staff with profile emails
    const { data: staffData } = await supabase.from('store_staff').select('*').eq('store_id', storeId);
    const staffList = (staffData || []).map((s: any) => ({
      ...s,
      userId: s.user_id || s.userId,
      storeId: s.store_id || s.storeId,
    }));

    // Fetch profiles for staff members
    const staffUserIds = staffList.map((s: any) => s.userId).filter(Boolean);
    if (staffUserIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('id, email, full_name').in('id', staffUserIds);
      const profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      staff = staffList.map((s: any) => {
        const profile = profilesMap.get(s.userId);
        return { ...s, email: profile?.email, fullName: profile?.full_name };
      });
    } else {
      staff = staffList;
    }
    
    // Fetch coupons
    const { data: couponData } = await supabase.from('coupons').select('*').eq('store_id', storeId);
    coupons = couponData || [];

    const perms = await getPermissionsForUser(supabase, session.user.id, storeId);
    permissions = perms.permissions as any;
    role = perms.role;
  }

  // Merging real store columns with settings object
  const mergedSettings: StoreSettings = {
    name: currentStore?.name || 'Ma Boutique',
    email: currentStore?.email || session.user.email || '',
    phone: currentStore?.phone || '',
    address: currentStore?.address || '',
    ninea: currentStore?.ninea || '',
    logo: currentStore?.settings?.logo || '',
    currency: currentStore?.settings?.currency || 'XOF',
    language: currentStore?.settings?.language || 'fr',
    description: currentStore?.description || '',
    ...(currentStore?.settings || {}) // Spread settings to catch any other custom fields
  };

  return (
    <SettingsView 
      storeSettings={mergedSettings}
      products={products}
      customers={customers}
      orders={orders}
      staff={staff}
      coupons={coupons}
      userRole={role as any}
      permissions={permissions as any}
      stores={stores}
      currentStoreId={storeId || ''}
      currentUserId={session.user.id}
      userName={profile?.full_name || session.user.email?.split('@')[0]}
      userEmail={session.user.email}
    />
  );
}
