import OrdersView from '@/views/OrdersView';
import { fetchStoreData } from '@/app/actions/store';
import { loadOrdersForStore } from '@/lib/load-store-data';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { Order, StaffRole, StaffPermissions } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';
import { toClientOrders } from '@/lib/product-image-url';

export default async function OrdersPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;
  
  const [orders, storeData] = await Promise.all([
    loadOrdersForStore(storeId, 10),
    fetchStoreData(storeId, undefined, { products: false, customers: false, invoices: false })
  ]);
  const { store } = storeData;
  const { permissions, role } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

  // Les lignes de commande embarquent l'image du produit : on la remplace par
  // l'endpoint d'image pour ne pas sérialiser de base64 dans la page.
  const clientOrders = toClientOrders(orders as unknown as Order[]);

  return (
    <OrdersView 
      orders={clientOrders} 
      permissions={permissions as unknown as StaffPermissions}
      userRole={role as unknown as StaffRole}
      currentStoreId={storeId}
      store={store as unknown as { id: string; name?: string | null; settings?: { [key: string]: unknown } | null }}
    />
  );
}
