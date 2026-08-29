'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { uploadDataUriToR2 } from '@/lib/r2'
import { db } from '@/db'
import { stores, profiles, coupons, storeStaff } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { StoreSettings } from '@/types'

export async function updateStoreSettingsAction(storeId: string, settings: StoreSettings) {
    try {
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
        const email = staff?.email;
        if (!email) return { success: false, error: 'Email manquant' };

        let [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
        if (!profile) {
            [profile] = await db.insert(profiles).values({
                email,
                fullName: email.split('@')[0] || 'Employé',
            }).returning();
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
