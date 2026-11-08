import CustomersView from '@/views/CustomersView';
import { fetchStoreData } from '@/app/actions/store';
import { saveCustomerAction, deleteCustomerAction, bulkDeleteCustomersAction } from '@/app/actions/customers';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { Customer, StaffRole, StaffPermissions } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';

export default async function CustomersPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;
  
  const { customers } = await fetchStoreData(storeId, undefined, { products: false, orders: false, invoices: false, customersLimit: 10 });
  const { permissions, role } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

  // Define client-side compatible wrappers for server actions
  async function onSaveCustomer(customer: Customer) {
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
      customers={customers as unknown as Customer[]} 
      permissions={permissions as unknown as StaffPermissions}
      userRole={role as unknown as StaffRole}
      currentStoreId={storeId}
      onSaveCustomer={onSaveCustomer}
      onDeleteCustomer={onDeleteCustomer}
      onBulkDeleteCustomers={onBulkDeleteCustomers}
    />
  );
}
