import DashboardView from '@/views/DashboardView';
import { fetchStoreData } from '@/app/actions/store';
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
  
  const { products, orders, customers } = await fetchStoreData(storeId);
  const { data: profile } = await safeSupabaseFetch<any>(
    () => supabase.from('profiles').select('*').eq('id', user.id).single()
  );
  const { permissions, role } = await getPermissionsForUser(supabase, user.id, storeId);

  return (
    <DashboardView 
      products={products as any} 
      orders={orders as any} 
      customers={customers as any} 
      userName={profile?.full_name || user.email?.split('@')[0]}
      userRole={role as any}
      permissions={permissions as any}
    />
  );
}
