import ReportsView from '@/views/ReportsView';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { StoreSettings, Order, Customer, StaffRole, StaffPermissions } from '@/types';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);

  if (!storeId) return <NoStoreFound />;
  
  const [orders, storeData] = await Promise.all([
    loadOrdersForStore(storeId),
    fetchStoreData(storeId, undefined, { products: false, invoices: false })
  ]);
  const { customers, store } = storeData;
  const { permissions, role } = await getPermissionsForUser(supabase, session.user.id, storeId);

  return (
    <ReportsView 
      orders={orders as unknown as Order[]} 
      customers={customers as unknown as Customer[]} 
      storeSettings={store?.settings as StoreSettings}
      store={store as unknown as { id: string; name?: string | null; settings?: { [key: string]: unknown } | null }}
      permissions={permissions as unknown as StaffPermissions}
      userRole={role as unknown as StaffRole}
    />
  );
}
