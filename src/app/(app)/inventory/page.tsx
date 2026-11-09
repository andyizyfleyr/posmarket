import InventoryView from '@/views/InventoryView';
import { fetchStoreData } from '@/app/actions/store';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { BusinessVertical, Product, StaffRole, StaffPermissions } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';
import { toClientProducts } from '@/lib/product-image-url';

export default async function InventoryPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;
  
  const { products, productsTotal, subscription, store } = await fetchStoreData(storeId, undefined, { orders: false, customers: false, invoices: false, productsLimit: 10 });
  const { permissions, role } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);
  const settings = store?.settings as { lowStockThreshold?: number } | undefined;
  const threshold = typeof settings?.lowStockThreshold === 'number' ? settings.lowStockThreshold : undefined;

  // Évite d'injecter les data URLs base64 des produits dans le HTML.
  const clientProducts = toClientProducts(products as unknown as Product[]);

  return (
    <InventoryView 
      products={clientProducts} 
      permissions={permissions as unknown as StaffPermissions}
      userRole={role as unknown as StaffRole}
      currentStoreId={storeId}
      subscription={subscription || undefined}
      businessType={store?.business_type as BusinessVertical | undefined}
      storeName={store?.name}
      lowStockThreshold={threshold}
      totalProducts={productsTotal}
    />
  );
}
