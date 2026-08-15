import DashboardView from '@/views/DashboardView';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import { safeSupabaseFetch } from '@/utils/supabase/retry';
import NoStoreFound from '@/components/NoStoreFound';

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
      products={products as any} 
      orders={orders as any} 
      store={store}
      userName={store?.name || user.email?.split('@')[0]}
      userRole={role as any}
      permissions={permissions as any}
    />
  );
}
