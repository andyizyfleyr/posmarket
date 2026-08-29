import InvoicesView from '@/views/InvoicesView';
import { fetchStoreData } from '@/app/actions/store';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { StoreSettings, Invoice, Customer, Product, StaffRole, StaffPermissions } from '@/types';

export default async function InvoicesPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);

  if (!storeId) return <NoStoreFound />;
  
  const { invoices, products, customers, store } = await fetchStoreData(storeId, undefined, { orders: false });
  const { permissions, role } = await getPermissionsForUser(supabase, session.user.id, storeId);

  return (
    <InvoicesView 
      invoices={invoices as unknown as Invoice[]} 
      products={products as unknown as Product[]}
      customers={customers as unknown as Customer[]}
      storeSettings={store?.settings as StoreSettings}
      permissions={permissions as unknown as StaffPermissions}
      userRole={role as unknown as StaffRole}
    />
  );
}
