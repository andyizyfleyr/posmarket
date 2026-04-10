import OrdersView from '@/views/OrdersView';
import { fetchStoreData } from '@/app/actions/store';
import { updateOrderStatusAction, deleteOrderAction } from '@/app/actions/orders';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);

  if (!storeId) return <NoStoreFound />;
  
  const { orders, store } = await fetchStoreData(storeId);
  const { permissions, role } = await getPermissionsForUser(supabase, session.user.id, storeId);

  return (
    <OrdersView 
      orders={orders as any} 
      permissions={permissions as any}
      userRole={role as any}
      currentStoreId={storeId}
      store={store as any}
    />
  );
}
