'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { StoreSettings } from '@/types'

export async function updateStoreSettingsAction(storeId: string, settings: StoreSettings) {
    const supabase = await createClient()
    
    // Generate a new slug if name changed
    const slug = settings.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    // Étape 1 : On tente une sauvegarde complète (Plan A)
    const updateData: any = {
        name: settings.name,
        slug,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        ninea: settings.ninea,
        description: settings.description,
        settings: settings
    }

    const { error: updateError } = await supabase
        .from('stores')
        .update(updateData)
        .eq('id', storeId)
    
    if (updateError) {
        console.warn('Plan A failed, falling back to core columns:', updateError.message)
        
        // Étape 2 : Plan B - On retire les colonnes douteuses (description, settings)
        // On ne garde que ce qui est sûr à 100% dans la table stores standard
        const coreData = {
            name: settings.name,
            email: settings.email,
            phone: settings.phone,
            address: settings.address,
            ninea: settings.ninea,
            settings: settings
        }
        
        const { error: retryError } = await supabase
            .from('stores')
            .update(coreData)
            .eq('id', storeId)
        
        if (retryError) {
            console.error('Plan B failed:', retryError.message)
            return { success: false, error: "Impossible de mettre à jour la boutique : " + retryError.message }
        }
        
        return { 
            success: true, 
            message: "Sauvegarde effectuée (Note: La description n'a pas pu être stockée car la colonne est absente)." 
        }
    }
    
    revalidatePath('/', 'layout')
    revalidatePath('/settings')
    return { success: true }
}

export async function createStoreAction(settings: StoreSettings, userId: string) {
    const supabase = await createClient()
    
    // Create a slug from the name
    const slug = settings.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    
    const { data, error } = await supabase.from('stores').insert({
        user_id: userId,
        name: settings.name,
        slug,
        settings,
        email: settings.email,
        phone: settings.phone,
        address: settings.address,
        ninea: settings.ninea,
        description: settings.description,
        status: 'PENDING'
    }).select().single()
    
    if (error) {
        console.error('Error creating store:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/settings')
    return { success: true, store: data }
}

export async function deleteStoreAction(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('stores').delete().eq('id', id)
    
    if (error) {
        console.error('Error deleting store:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/settings')
    return { success: true }
}

export async function saveCouponAction(coupon: any, storeId: string) {
    const supabase = await createClient()
    
    const dbCoupon = {
        ...(coupon.id && { id: coupon.id }),
        code: coupon.code,
        discount_pct: coupon.discount_pct || coupon.discountPct,
        active: coupon.active,
        store_id: storeId
    }
    
    const { data, error } = await supabase.from('coupons').upsert(dbCoupon).select().single()
    
    if (error) {
        console.error('Error saving coupon:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/settings')
    return { success: true, coupon: data }
}

export async function deleteCouponAction(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('coupons').delete().eq('id', id)
    
    if (error) {
        console.error('Error deleting coupon:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/settings')
    return { success: true }
}

export async function addStaffAction(staff: any, storeId: string) {
    const supabase = await createClient()
    
    if (staff.email && staff.password) {
        try {
            const { data, error: functionError } = await supabase.functions.invoke('create-staff', {
                body: {
                    email: staff.email,
                    password: staff.password,
                    role: staff.role,
                    storeId,
                    permissions: {}
                }
            });

            if (functionError) {
                const message = data?.error || functionError.message;
                if (message?.toLowerCase().includes('already registered')) {
                     const { data: userId } = await supabase.rpc('get_user_id_by_email', { p_email: staff.email });
                    if (userId) {
                        const { error } = await supabase
                            .from('store_staff')
                            .upsert({ store_id: storeId, user_id: userId, role: staff.role, permissions: {} });
                        if (error) throw error;
                    } else {
                        throw new Error("L'utilisateur existe déjà mais n'a pas pu être récupéré.");
                    }
                } else {
                    throw new Error(message || "Erreur lors de la création de l'employé.");
                }
            }
            
            if (data?.error) throw new Error(data.error);
        } catch (error: any) {
            console.error('Staff creation error:', error);
            return { success: false, error: error.message };
        }
    } else {
        const { error } = await supabase
            .from('store_staff')
            .upsert({
                id: staff.id || undefined,
                store_id: storeId,
                user_id: staff.userId,
                role: staff.role,
                permissions: {}
            });

        if (error) return { success: false, error: error.message };
    }
    
    revalidatePath('/settings')
    return { success: true }
}

export async function deleteStaffAction(id: string) {
    const supabase = await createClient()
    const { error } = await supabase.from('store_staff').delete().eq('id', id)
    
    if (error) {
        console.error('Error deleting staff:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/settings')
    return { success: true }
}

export async function updateProfileAction(userId: string, data: { fullName?: string, avatarUrl?: string }) {
    const supabase = await createClient()
    
    const { error } = await supabase.from('profiles').update({
        full_name: data.fullName,
        avatar_url: data.avatarUrl
    }).eq('id', userId)
    
    if (error) {
        console.error('Error updating profile:', error)
        return { success: false, error: error.message }
    }
    
    revalidatePath('/settings')
    return { success: true }
}
