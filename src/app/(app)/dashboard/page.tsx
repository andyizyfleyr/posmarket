import DashboardView from '@/views/DashboardView';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { Product, Order, StaffRole, StaffPermissions } from '@/types';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const storeId = await getEffectiveStoreId(supabase, { user });

  if (!storeId) return <NoStoreFound />;
  
  const [orders, storeData] = await Promise.all([
    loadOrdersForStore(storeId),
    fetchStoreData(storeId, undefined, { orders: false, customers: false, invoices: false })
  ]);
  const { products, store } = storeData;
  const { permissions, role } = await getPermissionsForUser(supabase, user.id, storeId);

  return (
    <DashboardView 
      products={products as unknown as Product[]} 
      orders={orders as unknown as Order[]} 
      store={store ? (store as { id: string; name?: string; business_type?: 'shopping' | 'food'; views?: number; [key: string]: unknown }) : undefined}
      userName={store?.name || user.email?.split('@')[0]}
      userRole={role as unknown as StaffRole}
      permissions={permissions as unknown as StaffPermissions}
    />
  );
}
