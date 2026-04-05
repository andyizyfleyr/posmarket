import InvoicesView from '@/views/InvoicesView';
import { fetchStoreData } from '@/app/actions/store';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);

  if (!storeId) return <NoStoreFound />;
  
  const { invoices, products, customers } = await fetchStoreData(storeId);
  const { data: storeRes } = await supabase.from('stores').select('*').eq('id', storeId).single();
  const { permissions, role } = await getPermissionsForUser(supabase, session.user.id, storeId);

  return (
    <InvoicesView 
      invoices={invoices as any} 
      products={products as any}
      customers={customers as any}
      storeSettings={storeRes?.settings || {}}
      permissions={permissions as any}
      userRole={role as any}
    />
  );
}
