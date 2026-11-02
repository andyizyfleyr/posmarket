import DashboardView from '@/views/DashboardView';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import { getAccountAccess, getSessionUser } from '@/lib/request-cache';
import NoStoreFound from '@/components/NoStoreFound';
import { Product, Order, StaffRole, StaffPermissions } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';

export default async function DashboardPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();
  // Même requête, même cache : ces appels ne repaieront pas la base.
  const user = await getSessionUser();
  const access = user ? await getAccountAccess(user.id) : null;

  if (!storeId) return <NoStoreFound />;
  
  const [orders, storeData] = await Promise.all([
    loadOrdersForStore(storeId),
    fetchStoreData(storeId, undefined, { orders: false, customers: false, invoices: false })
  ]);
  const { products, store } = storeData;
  const { permissions, role } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

  return (
    <DashboardView 
      products={products as unknown as Product[]} 
      orders={orders as unknown as Order[]} 
      store={store ? (store as { id: string; name?: string; business_type?: 'shopping' | 'food'; views?: number; [key: string]: unknown }) : undefined}
      userName={store?.name || user?.email?.split('@')[0]}
      userAvatarUrl={access?.profile?.avatarUrl || user?.avatarUrl || undefined}
      userRole={role as unknown as StaffRole}
      permissions={permissions as unknown as StaffPermissions}
    />
  );
}
