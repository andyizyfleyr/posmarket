import POSView from '@/views/POSView';
import { fetchStoreData } from '@/app/actions/store';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { Product, Customer, StaffPermissions, StoreSettings } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';

export default async function POSPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;
  
  const { products, customers, store } = await fetchStoreData(storeId, undefined, { orders: false, invoices: false, productStats: false });
  const { permissions } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

  return (
    <POSView 
      products={products as unknown as Product[]} 
      customers={customers as unknown as Customer[]} 
      currentStoreId={storeId}
      storeSettings={(store?.settings || {}) as StoreSettings}
      permissions={permissions as unknown as StaffPermissions}
      businessType={store?.business_type}
    />
  );
}
