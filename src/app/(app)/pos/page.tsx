import POSView from '@/views/POSView';
import { fetchStoreData } from '@/app/actions/store';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { Product, Customer, StaffPermissions, StoreSettings } from '@/types';

export default async function POSPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const storeId = await getEffectiveStoreId(supabase, { user });

  if (!storeId) return <NoStoreFound />;
  
  const { products, customers, store } = await fetchStoreData(storeId, undefined, { orders: false, invoices: false });
  const { permissions, role } = await getPermissionsForUser(supabase, user.id, storeId);

  return (
    <POSView 
      products={products as unknown as Product[]} 
      customers={customers as unknown as Customer[]} 
      currentStoreId={storeId}
      storeSettings={(store?.settings || {}) as StoreSettings}
      permissions={permissions as unknown as StaffPermissions}
      businessType={store?.business_type}
    />
  );
}
