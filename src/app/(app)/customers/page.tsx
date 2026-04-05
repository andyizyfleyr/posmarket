import CustomersView from '@/views/CustomersView';
import { fetchStoreData } from '@/app/actions/store';
import { saveCustomerAction, deleteCustomerAction, bulkDeleteCustomersAction } from '@/app/actions/customers';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);

  if (!storeId) return <NoStoreFound />;
  
  const { customers } = await fetchStoreData(storeId);
  const { permissions, role } = await getPermissionsForUser(supabase, session.user.id, storeId);

  // Define client-side compatible wrappers for server actions
  async function onSaveCustomer(customer: any) {
    'use server';
    return await saveCustomerAction(customer, storeId!);
  }

  async function onDeleteCustomer(id: string) {
    'use server';
    return await deleteCustomerAction(id);
  }

  async function onBulkDeleteCustomers(ids: string[]) {
    'use server';
    return await bulkDeleteCustomersAction(ids);
  }

  return (
    <CustomersView 
      customers={customers as any} 
      permissions={permissions as any}
      userRole={role as any}
      currentStoreId={storeId}
      onSaveCustomer={onSaveCustomer}
      onDeleteCustomer={onDeleteCustomer}
      onBulkDeleteCustomers={onBulkDeleteCustomers}
    />
  );
}
