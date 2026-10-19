import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { coupons, profiles, storeStaff, stores } from '@/db/schema';
import { requireStoreAccess } from '@/lib/authorization';
import { requireSellerSpace, resolveMobileStoreId } from '@/lib/mobile-space';
import type { StoreSettings } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/seller/settings?storeId=...
 *
 * Données de la page Réglages pour l'app mobile : réglages fusionnés de la
 * boutique (colonnes + JSONB, comme `settings/page.tsx`), équipe, coupons et
 * profil de l'utilisateur.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireSellerSpace();
    if (!guard.ok) return guard.response;

    const { searchParams } = new URL(req.url);
    const storeId = await resolveMobileStoreId(
      guard.userId,
      searchParams.get('storeId'),
    );

    // Profil de session : utilisé pour les défauts e-mail/nom du web.
    const [profile] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
      })
      .from(profiles)
      .where(eq(profiles.id, guard.userId))
      .limit(1)
      .catch(() => []);

    const userEmail = profile?.email || '';
    const userName = profile?.fullName || userEmail.split('@')[0] || '';
    const user = {
      id: guard.userId,
      email: userEmail,
      fullName: userName,
      avatarUrl: profile?.avatarUrl || null,
    };

    // Aucune boutique : mêmes défauts que la page web (« Ma Boutique », XOF).
    if (!storeId) {
      const storeSettings: StoreSettings = {
        name: 'Ma Boutique',
        email: userEmail,
        phone: '',
        address: '',
        ninea: '',
        logo: '',
        currency: 'XOF',
        language: 'fr',
        description: '',
      };
      return NextResponse.json({ success: true, storeSettings, staff: [], coupons: [], user });
    }

    // `resolveMobileStoreId` retient le cookie/id demandé sans contrôler
    // l'accès : on revérifie l'appartenance avant de renvoyer quoi que ce soit.
    const access = await requireStoreAccess(storeId);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error });
    }

    const [currentStore] = await db
      .select()
      .from(stores)
      .where(eq(stores.id, storeId))
      .limit(1);
    if (!currentStore) {
      return NextResponse.json({ success: false, error: 'Boutique introuvable' });
    }

    // Même fusion que `settings/page.tsx` : colonnes puis spread du JSONB.
    const settingsObj = (currentStore.settings || {}) as StoreSettings;
    const baseSettings: StoreSettings = {
      name: currentStore.name || 'Ma Boutique',
      email: currentStore.email || userEmail || '',
      phone: currentStore.phone || '',
      address: currentStore.address || '',
      ninea: currentStore.ninea || '',
      logo: settingsObj.logo || '',
      currency: settingsObj.currency || 'XOF',
      language: settingsObj.language || 'fr',
      description: currentStore.description || '',
    };
    const storeSettings: StoreSettings = { ...baseSettings, ...settingsObj };

    // Équipe + profils (email / nom), comme la jointure de la page web.
    const staffRows = await db
      .select()
      .from(storeStaff)
      .where(eq(storeStaff.storeId, storeId));
    const staffUserIds = staffRows.map((row) => row.userId).filter(Boolean);
    const staffProfiles = staffUserIds.length
      ? await db
          .select({ id: profiles.id, email: profiles.email, fullName: profiles.fullName })
          .from(profiles)
          .where(inArray(profiles.id, staffUserIds))
      : [];
    const profilesMap = new Map(staffProfiles.map((row) => [row.id, row]));
    const staff = staffRows.map((row) => {
      const staffProfile = profilesMap.get(row.userId);
      return {
        id: row.id,
        userId: row.userId,
        storeId: row.storeId,
        role: row.role,
        email: staffProfile?.email ?? null,
        fullName: staffProfile?.fullName ?? null,
      };
    });

    const couponRows = await db
      .select()
      .from(coupons)
      .where(eq(coupons.storeId, storeId));
    const couponList = couponRows.map((row) => ({
      id: row.id,
      code: row.code,
      discount_pct: Number(row.discountPct) || 0,
      active: row.active,
      store_id: row.storeId,
      created_at: row.createdAt?.toISOString(),
    }));

    return NextResponse.json({
      success: true,
      storeSettings,
      staff,
      coupons: couponList,
      user,
    });
  } catch (error) {
    console.error('[API] seller/settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Chargement impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
