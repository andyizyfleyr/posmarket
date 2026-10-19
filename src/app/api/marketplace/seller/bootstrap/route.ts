import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/app/actions/session';
import { canAccessSellerSpace, resolveAccountAccess } from '@/utils/account-access';
import { getStoreCookie } from '@/utils/store-cookie';
import { createClient } from '@/utils/supabase/server';
import { getPermissionsForUser } from '@/utils/permissions';
import { getSubscriptionPlan, SUBSCRIPTION_PLANS } from '@/constants';
import type { StaffRole, SubscriptionDuration, SubscriptionTier, UserSubscription } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/bootstrap
 *
 * Données de coquille de l'espace vendeur pour l'app mobile : profil, boutiques
 * (possédées + équipe), boutique courante, rôle, permissions, abonnement.
 * Reproduit exactement la logique de `src/app/(app)/layout.tsx` et
 * `src/components/LayoutClientWrapper.tsx`.
 */
export async function GET(_req: NextRequest) {
  try {
    const { user } = await getCurrentSession();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' });
    }

    const access = await resolveAccountAccess(user.id);
    if (!canAccessSellerSpace(access.space) || !access.profile) {
      return NextResponse.json({ success: false, error: 'Forbidden', space: access.space });
    }

    const profile = access.profile;

    // Boutiques : propriétaire + équipe, dédupliquées, plus anciennes d'abord.
    const byId = new Map<string, (typeof access.ownedStores)[number]>();
    for (const store of [...access.ownedStores, ...access.staffStores]) {
      byId.set(store.id, store);
    }
    const allStores = [...byId.values()].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );

    const stores = allStores.map((store) => {
      const staffEntry = access.staffEntries.find((entry) => entry.storeId === store.id);
      const settings = (store.settings as Record<string, unknown>) || {};
      return {
        id: store.id,
        slug: store.slug,
        name: store.name,
        status: store.status,
        businessType: store.businessType,
        description: store.description || (settings.description as string) || '',
        logo: store.logo || '',
        ownerId: store.userId,
        views: store.views || 0,
        settings: {
          name: store.name,
          email: store.email || '',
          phone: store.phone || '',
          address: store.address || '',
          ninea: store.ninea || '',
          ...settings,
        },
        staff: staffEntry
          ? [{ id: staffEntry.id, userId: user.id, storeId: store.id, role: staffEntry.role }]
          : [],
      };
    });

    let currentStoreId = await getStoreCookie();
    if (!stores.some((store) => store.id === currentStoreId)) {
      currentStoreId = stores[0]?.id || null;
    }
    const currentStore = stores.find((store) => store.id === currentStoreId) || null;

    let role: StaffRole = 'OWNER';
    if (profile.isSuperAdmin) {
      role = 'SUPER_ADMIN';
    } else if (currentStore && currentStore.ownerId !== user.id) {
      const entry = access.staffEntries.find((item) => item.storeId === currentStore.id);
      if (entry) role = entry.role as StaffRole;
    }

    const subscription: UserSubscription = {
      tier: (profile.subscriptionTier as SubscriptionTier) || 'NONE',
      duration: (profile.subscriptionDuration as SubscriptionDuration) || 'monthly',
      startDate: profile.subscriptionStartDate?.toISOString() || new Date().toISOString(),
      endDate: profile.subscriptionEndDate?.toISOString() || new Date().toISOString(),
      status: (profile.subscriptionStatus as UserSubscription['status']) || 'NONE',
    };

    const plan = getSubscriptionPlan(subscription.tier) || SUBSCRIPTION_PLANS.PRO;

    // Identique à LayoutClientWrapper : tier payant + statut actif + non expiré.
    const subscriptionValid =
      (subscription.tier === 'STARTER' ||
        subscription.tier === 'PRO' ||
        subscription.tier === 'ENTERPRISE') &&
      subscription.status === 'ACTIVE' &&
      new Date(subscription.endDate) > new Date();

    let permissions: Record<string, boolean> = {};
    if (currentStore) {
      const supabase = await createClient();
      const result = await getPermissionsForUser(supabase, user.id, currentStore.id);
      permissions = result.permissions as unknown as Record<string, boolean>;
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email.split('@')[0] || 'Commerçant',
        avatarUrl: user.avatarUrl || null,
        isSuperAdmin: user.isSuperAdmin,
      },
      space: access.space,
      stores,
      currentStoreId,
      role,
      permissions,
      subscription,
      plan,
      subscriptionValid,
    });
  } catch (error) {
    console.error('[API] seller/bootstrap error:', error);
    return NextResponse.json(
      { success: false, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
