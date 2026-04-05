import ReportsView from '@/views/ReportsView';
import { fetchStoreData } from '@/app/actions/store';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import NoStoreFound from '@/components/NoStoreFound';

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);

  if (!storeId) return <NoStoreFound />;
  
  const { orders, customers } = await fetchStoreData(storeId);
  const { data: storeRes } = await supabase.from('stores').select('*').eq('id', storeId).single();

  return (
    <ReportsView 
      orders={orders as any} 
      customers={customers as any} 
      storeSettings={storeRes?.settings || {}}
    />
  );
}
