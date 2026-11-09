import { redirect } from 'next/navigation';
import LayoutClientWrapper from '@/components/LayoutClientWrapper';
import { StoreData, SubscriptionTier, SubscriptionDuration, StaffRole, UserSubscription } from '@/types';
import { getSubscriptionPlan, SUBSCRIPTION_PLANS } from '@/constants';
import { toIsoDateString } from '@/utils';
import { canAccessSellerSpace, landingPathFor } from '@/utils/account-access';
import { getStoreCookie } from '@/utils/store-cookie';
import { getAccountAccess, getSessionUser } from '@/lib/request-cache';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Les types locaux (ProfileData / StoreRowData / StaffEntryData) ont été retirés :
// les données viennent désormais de Drizzle, typées par `resolveAccountAccess`.

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // `createClient()` masque volontairement les profils acheteurs : la session
  // brute est donc lue séparément, sinon un client qui ouvre /pos serait
  // renvoyé vers /login au lieu de son espace compte.
  //
  // Les deux lectures sont mémoïsées par requête : les pages enfants appellent
  // les mêmes fonctions, elles ne repaieront pas les requêtes. Sans cela, le
  // rendu lisait `profiles`, `stores` et `store_staff` deux fois par chemin
  // (une fois ici, une fois dans chaque page).
  const user = await getSessionUser();

  if (!user) {
    redirect('/login');
  }

  // Résolution partagée avec la garde de `/mon-compte` : un seul calcul de
  // rôle pour les deux espaces, donc aucun conflit de redirection possible.
  const access = await getAccountAccess(user.id);

  if (!canAccessSellerSpace(access.space)) {
    // 'none'/'anonymous' retombent sur l'espace compte : `canAccessBuyerSpace`
    // l'autorise, la boucle de redirection est donc impossible.
    redirect(landingPathFor(access.space));
  }

  // Seules sources de vérité désormais : `access` (profil + boutiques) déjà
  // chargé par `getAccountAccess`, et le cookie de boutique. Les trois requêtes
  // Supabase qui relisaient `profiles`, `stores` et `store_staff` juste après
  // `resolveAccountAccess` sont supprimées — elles lisaient les mêmes lignes.
  const profile = access.profile;
  const ownedStores = access.ownedStores;
  const staffEntries = access.staffEntries;
  const staffStores = access.staffStores;

  const userSubscription: UserSubscription = {
    tier: (profile?.subscriptionTier as SubscriptionTier) || 'NONE',
    duration: (profile?.subscriptionDuration as SubscriptionDuration) || 'monthly',
    startDate: toIsoDateString(profile?.subscriptionStartDate, new Date().toISOString()),
    endDate: toIsoDateString(profile?.subscriptionEndDate, new Date().toISOString()),
    status: (profile?.subscriptionStatus as UserSubscription['status']) || 'NONE'
  };

  const currentPlan = getSubscriptionPlan(userSubscription.tier) || SUBSCRIPTION_PLANS.PRO;

  const allRawStores = [
    ...ownedStores,
    ...staffStores,
  ]
  .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Deduplicate
  .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()); // Ensure oldest first

  const stores = allRawStores.map(s => {
    const staffEntry = staffEntries.find(entry => entry.storeId === s.id);
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      status: s.status,
      description: s.description || (s.settings as Record<string, unknown>)?.description || '',
      ownerId: s.userId,
      views: s.views || 0,
      settings: {
        name: s.name,
        email: s.email || '',
        phone: s.phone || '',
        address: s.address || '',
        ninea: s.ninea || '',
        ...(s.settings as Record<string, unknown>) // Merge with JSONB settings if exists
      },
      staff: staffEntry ? [{
        id: staffEntry.id || '',
        userId: user.id,
        storeId: s.id,
        role: staffEntry.role
      }] : [],
      products: [],
      customers: [],
      orders: [],
      invoices: []
    } as unknown as StoreData;
  });

  let currentStoreId = await getStoreCookie();

  if (stores.length > 0) {
    const exists = stores.find(s => s.id === currentStoreId);
    if (!exists) {
      currentStoreId = stores[0].id;
    }
  }

  const currentStore = stores.find(s => s.id === currentStoreId) || stores[0] || null;

  let currentUserRole: StaffRole = 'OWNER';
  if (profile?.isSuperAdmin) {
    currentUserRole = 'SUPER_ADMIN';
  } else if (currentStore) {
    if (currentStore.ownerId !== user.id) {
        const staffInThisStore = staffEntries.find(st => st.storeId === currentStore.id);
        if (staffInThisStore) currentUserRole = staffInThisStore.role as StaffRole;
    }
  }

  return (
    <LayoutClientWrapper
      stores={stores}
      currentStore={currentStore}
      currentPlan={currentPlan}
      userEmail={user.email!}
            userAvatarUrl={user.avatarUrl}
      userSubscription={userSubscription}
      currentUserRole={currentUserRole}
    >
      {children}
    </LayoutClientWrapper>
  );
}
