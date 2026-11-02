import InvoicesView from '@/views/InvoicesView';
import { fetchStoreData } from '@/app/actions/store';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { StoreSettings, Invoice, Customer, Product, StaffRole, StaffPermissions } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';

export default async function InvoicesPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;
  
  const { invoices, products, customers, store } = await fetchStoreData(storeId, undefined, { orders: false });
  const { permissions, role } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

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
