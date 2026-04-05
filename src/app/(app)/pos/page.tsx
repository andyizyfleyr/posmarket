import POSView from '@/views/POSView';
import { fetchStoreData } from '@/app/actions/store';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import { safeSupabaseFetch } from '@/utils/supabase/retry';
import NoStoreFound from '@/components/NoStoreFound';

export default async function POSPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) return null;

  const storeId = await getEffectiveStoreId(supabase, { user });

  if (!storeId) return <NoStoreFound />;
  
  const { products, customers } = await fetchStoreData(storeId);
  const { data: storeRes } = await safeSupabaseFetch<any>(
    () => supabase.from('stores').select('*').eq('id', storeId).single()
  );
  const { permissions, role } = await getPermissionsForUser(supabase, user.id, storeId);

  return (
    <POSView 
      products={products as any} 
      customers={customers as any} 
      currentStoreId={storeId}
      storeSettings={storeRes as any}
      permissions={permissions as any}
    />
  );
}
