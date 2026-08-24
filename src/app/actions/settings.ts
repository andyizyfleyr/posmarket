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

        const updateData: any = {
            name: settings.name,
            slug,
            email: settings.email,
            phone: settings.phone,
            address: settings.address,
            ninea: settings.ninea,
            settings: settings
        };

        await db.update(stores).set(updateData).where(eq(stores.id, storeId));

        revalidatePath('/', 'layout');
        revalidatePath('/settings');
        updateTag('marketplace');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating store settings with Drizzle:', error);
        return { success: false, error: "Impossible de mettre à jour la boutique : " + error.message };
    }
}

export async function createStoreAction(settings: StoreSettings, userId: string) {
    try {
        const slug = settings.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        
        const [newStore] = await db.insert(stores).values({
            userId: userId || '00000000-0000-0000-0000-000000000000',
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
    } catch (error: any) {
        console.error('Error creating store with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteStoreAction(id: string) {
    try {
        await db.delete(stores).where(eq(stores.id, id));
        revalidatePath('/', 'layout');
        updateTag('marketplace');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting store with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function updateProfileSettingsAction(userId: string, data: { fullName: string, email: string }) {
    try {
        await db.update(profiles).set({
            fullName: data.fullName,
            email: data.email
        }).where(eq(profiles.id, userId));

        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        console.error('Error updating profile with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

// Coupons
export async function saveCouponAction(coupon: any, storeId: string) {
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
    } catch (error: any) {
        console.error('Error saving coupon with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteCouponAction(id: string) {
    try {
        await db.delete(coupons).where(eq(coupons.id, id));
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting coupon with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function toggleCouponAction(id: string, active: boolean) {
    try {
        await db.update(coupons).set({ active }).where(eq(coupons.id, id));
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        console.error('Error toggling coupon with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

// Staff
export async function addStaffAction(staff: any, storeId: string) {
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
    } catch (error: any) {
        console.error('Error adding staff with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteStaffAction(id: string) {
    try {
        await db.delete(storeStaff).where(eq(storeStaff.id, id));
        revalidatePath('/settings');
        return { success: true };
    } catch (error: any) {
        console.error('Error deleting staff with Drizzle:', error);
        return { success: false, error: error.message };
    }
}

export async function updateProfileAction(userId: string, data: any) {
    return updateProfileSettingsAction(userId, data);
}
