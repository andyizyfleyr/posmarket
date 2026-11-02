import ReportsView from '@/views/ReportsView';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { StoreSettings, Order, Customer, StaffRole, StaffPermissions } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';

export default async function ReportsPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;
  
  const [orders, storeData] = await Promise.all([
    loadOrdersForStore(storeId),
    fetchStoreData(storeId, undefined, { products: false, invoices: false })
  ]);
  const { customers, store } = storeData;
  const { permissions, role } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

  return (
    <ReportsView 
      orders={orders as unknown as Order[]} 
      customers={customers as unknown as Customer[]} 
      storeSettings={store?.settings as StoreSettings}
      store={store as unknown as { id: string; name?: string | null; settings?: { [key: string]: unknown } | null }}
      permissions={permissions as unknown as StaffPermissions}
      userRole={role as unknown as StaffRole}
    />
  );
}
