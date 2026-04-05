import InventoryView from '@/views/InventoryView';
import { fetchStoreData } from '@/app/actions/store';
import { saveProductAction, deleteProductAction, bulkDeleteProductsAction } from '@/app/actions/inventory';
import { getEffectiveStoreId } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';

export default async function InventoryPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const storeId = await getEffectiveStoreId(supabase, session);

  if (!storeId) return <NoStoreFound />;
  
  const { products, subscription } = await fetchStoreData(storeId);
  const { permissions, role } = await getPermissionsForUser(supabase, session.user.id, storeId);

  return (
    <InventoryView 
      products={products as any} 
      permissions={permissions as any}
      userRole={role as any}
      currentStoreId={storeId}
      subscription={subscription || undefined}
    />
  );
}
