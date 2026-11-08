import POSView from '@/views/POSView';
import { fetchStoreData } from '@/app/actions/store';
import { db } from '@/db';
import { coupons } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import NoStoreFound from '@/components/NoStoreFound';
import { Product, Customer, StaffPermissions, StoreSettings } from '@/types';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';

export default async function POSPage() {
  // La boutique courante est dédupliquée par requête : le layout a déjà
  // chargé le profil et les boutiques, cette résolution ne requête plus la base.
  const storeId = await resolveCurrentStoreId();

  if (!storeId) return <NoStoreFound />;

  // Données POS + coupons actifs en parallèle (les coupons étaient rechargés
  // côté client au montage : ce double aller-retour est supprimé).
  const [{ products, customers, store }, couponRows] = await Promise.all([
    fetchStoreData(storeId, undefined, { orders: false, invoices: false, productStats: false }),
    db
      .select()
      .from(coupons)
      .where(and(eq(coupons.storeId, storeId), eq(coupons.active, true))),
  ]);
  const { permissions } = await resolveStorePermissions(storeId, FULL_PERMISSIONS);

  return (
    <POSView 
      products={products as unknown as Product[]} 
      customers={customers as unknown as Customer[]} 
      currentStoreId={storeId}
      storeSettings={(store?.settings || {}) as StoreSettings}
      permissions={permissions as unknown as StaffPermissions}
      businessType={store?.business_type}
      coupons={couponRows.map((c) => ({
        id: c.id,
        code: c.code,
        discount_pct: Number(c.discountPct) || 0,
        active: c.active !== false,
        store_id: c.storeId,
        created_at: c.createdAt ? c.createdAt.toISOString() : undefined,
      }))}
    />
  );
}
