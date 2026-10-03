'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { uploadDataUriToR2 } from '@/lib/r2'
import { db } from '@/db'
import { stores, profiles, coupons, storeStaff } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { StoreSettings } from '@/types'
import { requireStoreAccess, requireSelfOrAdmin } from '@/lib/authorization'

/**
 * Résout la boutique d'une ligne (coupon, membre d'équipe) afin d'en vérifier
 * la propriété avant de la modifier ou de la supprimer.
 */
async function requireRowStoreAccess(
    table: typeof coupons | typeof storeStaff,
    id: string,
): Promise<{ ok: true; storeId: string } | { ok: false; error: string }> {
    const [row] = await db
        .select({ storeId: table.storeId })
        .from(table)
        .where(eq(table.id, id))
        .limit(1)
    if (!row) return { ok: false, error: 'Introuvable' }
    const access = await requireStoreAccess(row.storeId)
    if (!access.ok) return { ok: false, error: access.error }
    return { ok: true, storeId: row.storeId }
}

export async function updateStoreSettingsAction(storeId: string, settings: StoreSettings) {
    try {
        const access = await requireStoreAccess(storeId)
        if (!access.ok) return { success: false, error: access.error }

        if (typeof settings.logo === 'string' && settings.logo.startsWith('data:')) {
            const r2Logo = await uploadDataUriToR2(settings.logo, 'logos').catch(() => null);
            if (r2Logo) settings = { ...settings, logo: r2Logo };
        }

        const slug = settings.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        await db.update(stores).set({
            name: settings.name,
            slug,
            email: settings.email,
            phone: settings.phone,
            address: settings.address,
            ninea: settings.ninea,
            settings,
        }).where(eq(stores.id, storeId));

        revalidatePath('/settings');
        updateTag('marketplace');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error updating store settings with Drizzle:', error);
        return { success: false, error: "Impossible de mettre à jour la boutique : " + (error instanceof Error ? error.message : String(error)) };
    }
}

export async function createStoreAction(settings: StoreSettings, userId: string) {
    try {
        // Sans ce contrôle, n'importe qui pouvait créer une boutique au nom
        // d'un autre compte.
        const self = await requireSelfOrAdmin(userId)
        if (!self.ok) return { success: false, error: self.error }

        const slug = settings.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const [newStore] = await db.insert(stores).values({
            userId,
            name: settings.name,
            slug,
            settings,
            email: settings.email,
            phone: settings.phone,
            address: settings.address,
            ninea: settings.ninea,
        }).returning();

        revalidatePath('/settings');
        updateTag('marketplace');
        return { success: true, store: newStore };
    } catch (error: unknown) {
        console.error('Error creating store with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteStoreAction(id: string) {
    try {
        const access = await requireStoreAccess(id)
        if (!access.ok) return { success: false, error: access.error }

        await db.delete(stores).where(eq(stores.id, id));
        revalidatePath('/settings');
        updateTag('marketplace');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error deleting store with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function updateProfileSettingsAction(userId: string, data: { fullName: string, email?: string, avatarUrl?: string }) {
    try {
        const self = await requireSelfOrAdmin(userId)
        if (!self.ok) return { success: false, error: self.error }

        const updateData: Record<string, string> = {};
        if (data.fullName) updateData.fullName = data.fullName;
        if (data.email) updateData.email = data.email;

        await db.update(profiles).set(updateData as Partial<typeof profiles.$inferInsert>).where(eq(profiles.id, userId));

        revalidatePath('/settings');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error updating profile with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// Coupons
type CouponInput = {
  code?: string;
  discountPct?: number | string;
  active?: boolean;
  expiresAt?: string | Date | null;
}

export async function saveCouponAction(coupon: CouponInput, storeId: string) {
    try {
        const access = await requireStoreAccess(storeId)
        if (!access.ok) return { success: false, error: access.error }

        if (!coupon || !coupon.code) return { success: false, error: 'Code promo manquant' };

        const [saved] = await db.insert(coupons).values({
            storeId,
            code: coupon.code.toUpperCase(),
            discountPct: String(coupon.discountPct ?? 10),
            active: coupon.active !== false,
            expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt) : null,
        }).returning();

        revalidatePath('/settings');
        return { success: true, coupon: saved };
    } catch (error: unknown) {
        console.error('Error saving coupon with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteCouponAction(id: string) {
    try {
        const access = await requireRowStoreAccess(coupons, id)
        if (!access.ok) return { success: false, error: access.error }

        await db.delete(coupons).where(eq(coupons.id, id));
        revalidatePath('/settings');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error deleting coupon with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function toggleCouponAction(id: string, active: boolean) {
    try {
        const access = await requireRowStoreAccess(coupons, id)
        if (!access.ok) return { success: false, error: access.error }

        await db.update(coupons).set({ active }).where(eq(coupons.id, id));
        revalidatePath('/settings');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error toggling coupon with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// Staff
type StaffInput = {
  email?: string;
  role?: string;
  password?: string;
}

export async function addStaffAction(staff: StaffInput, storeId: string) {
    try {
        const access = await requireStoreAccess(storeId)
        if (!access.ok) return { success: false, error: access.error }

        const email = String(staff?.email || '').trim().toLowerCase();
        if (!email) return { success: false, error: 'Email manquant' };

        const [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
        if (!profile) {
            return {
                success: false,
                error: "Aucun compte n'est associé à cet email. L'employé doit d'abord créer son compte avant d'être ajouté à votre équipe.",
            };
        }
        if (profile.accountType === 'buyer' && !profile.isSuperAdmin) {
            return {
                success: false,
                error: "Cet email est associé à un compte acheteur. L'employé doit disposer d'un compte vendeur pour accéder au POS.",
            };
        }

        await db.insert(storeStaff).values({
            storeId,
            userId: profile.id,
            role: staff.role || 'SELLER',
        }).onConflictDoNothing();

        revalidatePath('/settings');
        return { success: true, staff: { ...staff, id: profile.id, userId: profile.id } };
    } catch (error: unknown) {
        console.error('Error adding staff with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function deleteStaffAction(id: string) {
    try {
        const access = await requireRowStoreAccess(storeStaff, id)
        if (!access.ok) return { success: false, error: access.error }

        await db.delete(storeStaff).where(eq(storeStaff.id, id));
        revalidatePath('/settings');
        return { success: true };
    } catch (error: unknown) {
        console.error('Error deleting staff with Drizzle:', error);
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

export async function updateProfileAction(userId: string, data: { fullName: string, email?: string, avatarUrl?: string }) {
    return updateProfileSettingsAction(userId, data);
}
