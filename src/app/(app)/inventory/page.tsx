import InventoryView from '@/views/InventoryView';
import { fetchStoreData } from '@/app/actions/store';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { BusinessVertical, Product, StaffRole, StaffPermissions } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';

export default async function InventoryPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;
  
  const { products, subscription, store } = await fetchStoreData(storeId, undefined, { orders: false, customers: false, invoices: false });
  const { permissions, role } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

  return (
    <InventoryView 
      products={products as unknown as Product[]} 
      permissions={permissions as unknown as StaffPermissions}
      userRole={role as unknown as StaffRole}
      currentStoreId={storeId}
      subscription={subscription || undefined}
      businessType={store?.business_type as BusinessVertical | undefined}
      storeName={store?.name}
    />
  );
}
