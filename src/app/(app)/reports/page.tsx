import ReportsView from '@/views/ReportsView';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import NoStoreFound from '@/components/NoStoreFound';

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

  return (
    <ReportsView 
      orders={orders as any} 
      customers={customers as any} 
      storeSettings={store?.settings || {}}
      store={store as any}
    />
  );
}
