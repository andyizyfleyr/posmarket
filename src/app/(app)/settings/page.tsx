import SettingsView from '@/views/SettingsView';
import { db } from '@/db';
import { coupons, profiles, stores, storeStaff } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { FULL_PERMISSIONS } from '@/utils/permissions';
import { resolveCurrentStoreId, resolveStorePermissions } from '@/lib/current-store';
import { getAccountAccess, getSessionUser } from '@/lib/request-cache';
import { StoreSettings, StoreData, Staff, StaffRole, StaffPermissions, Coupon } from '@/types';

export const dynamic = 'force-dynamic';

type StoreRowLite = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  ninea?: string | null;
  description?: string | null;
  settings?: StoreSettings | null;
};

export default async function SettingsPage() {
  // Session et accès déjà mémoïsés par le layout : aucune requête en double.
  const user = await getSessionUser();
  if (!user) return null;

  // Boutique courante dédupliquée : profil et boutiques déjà chargés par le layout.
  const [storeId, access] = await Promise.all([
    resolveCurrentStoreId(),
    getAccountAccess(user.id),
  ]);

  // Boutiques gérables (possédées + équipe), déjà chargées : zéro requête.
  const manageableStores = [...access.ownedStores, ...access.staffStores].filter(
    (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
  );

  const storesData: StoreData[] = manageableStores.map((s) => ({
    id: s.id,
    slug: s.slug || '',
    settings: (s.settings || {}) as StoreSettings,
    user_id: s.userId,
    name: s.name || '',
    email: s.email || '',
    phone: s.phone || '',
    address: s.address || '',
    description: s.description || '',
  }));

  let currentStore: StoreRowLite | null = null;
  let staff: Staff[] = [];
  let couponsList: Coupon[] = [];
  let permissions: StaffPermissions = FULL_PERMISSIONS;
  let role: StaffRole = 'OWNER';

  if (storeId) {
    // Tout part en parallèle : boutique, équipe, coupons et permissions.
    const [storeRows, staffRows, couponRows, perms] = await Promise.all([
      db.select().from(stores).where(eq(stores.id, storeId)).limit(1),
      db.select().from(storeStaff).where(eq(storeStaff.storeId, storeId)),
      db.select().from(coupons).where(eq(coupons.storeId, storeId)),
      resolveStorePermissions(storeId, FULL_PERMISSIONS),
    ]);

    currentStore = (storeRows[0] as unknown as StoreRowLite) ?? null;

    const staffUserIds = staffRows.map((s) => s.userId).filter(Boolean);
    const profilesRows = staffUserIds.length
      ? await db
          .select({
            id: profiles.id,
            email: profiles.email,
            fullName: profiles.fullName,
          })
          .from(profiles)
          .where(inArray(profiles.id, staffUserIds))
      : [];
    const profilesMap = new Map(profilesRows.map((p) => [p.id, p]));

    staff = staffRows.map((s) => {
      const p = profilesMap.get(s.userId);
      return {
        id: s.id,
        userId: s.userId,
        storeId: s.storeId,
        role: s.role as StaffRole,
        email: p?.email,
        fullName: p?.fullName,
      } as unknown as Staff;
    });

    couponsList = couponRows.map((c) => ({
      id: c.id,
      code: c.code,
      discount_pct: Number(c.discountPct) || 0,
      active: c.active !== false,
      store_id: c.storeId,
      created_at: c.createdAt ? (c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt)) : undefined,
    }));

    permissions = perms.permissions as unknown as StaffPermissions;
    role = perms.role as StaffRole;
  }

  // Merging real store columns with settings object
  const mergedSettings: StoreSettings = {
    name: currentStore?.name || 'Ma Boutique',
    email: currentStore?.email || user.email || '',
    phone: currentStore?.phone || '',
    address: currentStore?.address || '',
    ninea: currentStore?.ninea || '',
    logo: currentStore?.settings?.logo || '',
    currency: currentStore?.settings?.currency || 'XOF',
    language: currentStore?.settings?.language || 'fr',
    description: currentStore?.description || '',
    ...(currentStore?.settings || {}) // Spread settings to catch any other custom fields
  };

  return (
    <SettingsView
      storeSettings={mergedSettings}
      staff={staff}
      coupons={couponsList}
      userRole={role}
      permissions={permissions}
      stores={storesData}
      currentStoreId={storeId || ''}
      currentUserId={user.id}
      userName={user.user_metadata.full_name || user.email?.split('@')[0] || ''}
      userEmail={user.email}
      userAvatarUrl={user.avatarUrl}
    />
  );
}
