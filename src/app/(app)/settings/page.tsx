import SettingsView from '@/views/SettingsView';
import { fetchStoreData } from '@/app/actions/store';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser, FULL_PERMISSIONS } from '@/utils/permissions';
import { StoreSettings, StoreData, Product, Customer, Order, Staff, StaffRole, StaffPermissions, Coupon } from '@/types';

export const dynamic = 'force-dynamic';

type StoreRowLite = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  ninea?: string | null;
  description?: string | null;
  settings?: StoreSettings | null;
};

type RawStaffRow = Record<string, unknown>;

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  
  let currentStore: StoreRowLite | null = null;
  let products: Product[] = [];
  let customers: Customer[] = [];
  let orders: Order[] = [];
  let staff: Staff[] = [];
  let coupons: Coupon[] = [];
  let stores: StoreData[] = [];
  let permissions: StaffPermissions = FULL_PERMISSIONS;
  let role: StaffRole = 'OWNER';

  // Fetch all stores owned by this user
  const { data: allStores } = await supabase.from('stores').select('*').eq('user_id', session.user.id);
  
  if (allStores) {
    stores = allStores.map(s => ({
        id: String(s.id),
        slug: String(s.slug || ''),
        settings: (s.settings || {}) as StoreSettings,
        user_id: String(s.user_id),
        name: String(s.name)
    }));
  }

  if (storeId) {
    const { data: storeRes } = await supabase.from('stores').select('*').eq('id', storeId).single();
    currentStore = storeRes as unknown as StoreRowLite;

    const data = await fetchStoreData(storeId);
    products = data.products as unknown as Product[];
    customers = data.customers as unknown as Customer[];
    orders = data.orders as unknown as Order[];

    // Fetch staff with profile emails
    const { data: staffData } = await supabase.from('store_staff').select('*').eq('store_id', storeId);
    const staffList = (staffData || []).map((row: RawStaffRow) => ({
      ...row,
      userId: String(row.user_id ?? row.userId ?? ''),
      storeId: String(row.store_id ?? row.storeId ?? ''),
    }));

    // Fetch profiles for staff members
    const staffUserIds = staffList.map((s) => s.userId).filter(Boolean);
    if (staffUserIds.length > 0) {
      const { data: profilesData } = await supabase.from('profiles').select('id, email, full_name').in('id', staffUserIds);
      const profilesMap = new Map((profilesData || []).map((p: Record<string, unknown>) => [String(p.id), p]));
      staff = staffList.map((s) => {
        const profile = profilesMap.get(String(s.userId));
        return { ...s, email: profile?.email, fullName: profile?.full_name };
      }) as unknown as Staff[];
    } else {
      staff = staffList as unknown as Staff[];
    }
    
    // Fetch coupons
    const { data: couponData } = await supabase.from('coupons').select('*').eq('store_id', storeId);
    coupons = (couponData || []) as unknown as Coupon[];

    const perms = await getPermissionsForUser(supabase, session.user.id, storeId);
    permissions = perms.permissions as unknown as StaffPermissions;
    role = perms.role as StaffRole;
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
      userRole={role}
      permissions={permissions}
      stores={stores}
      currentStoreId={storeId || ''}
      currentUserId={session.user.id}
      userName={(profile?.full_name as string) || session.user.email?.split('@')[0] || ''}
      userEmail={session.user.email}
    />
  );
}
