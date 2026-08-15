import { cookies } from 'next/headers';
import { safeSupabaseFetch } from './supabase/retry';

export const getStoreCookie = async () => {
  const cookieStore = await cookies();
  return cookieStore.get('currentStoreId')?.value || null;
};

export const setStoreCookie = async (id: string) => {
  const cookieStore = await cookies();
  cookieStore.set('currentStoreId', id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
};

export const clearStoreCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.delete('currentStoreId');
};

export const getEffectiveStoreId = async (supabase: any, session: any): Promise<string | null> => {
  if (!session?.user) return null;
  
  const currentId = await getStoreCookie();
  
  // If we have a cookie, we MUST verify the user has access to it
  if (currentId) {
    // 1. Check owner + staff in parallel
    const [ownerRes, staffRes] = await Promise.all([
      supabase.from('stores')
        .select('id')
        .eq('id', currentId)
        .eq('user_id', session.user.id)
        .single(),
      supabase.from('store_staff')
        .select('id')
        .eq('store_id', currentId)
        .eq('user_id', session.user.id)
        .single()
    ]);

    if (ownerRes.data || staffRes.data) return currentId;
  }

  // Fallback to finding ANY store they have access to
  // 1. Owned stores
  const { data: owned } = await safeSupabaseFetch<any[]>(
    () => supabase.from('stores')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)
  );
  
  if (owned && owned.length > 0) {
    return owned[0].id;
  }

  // 2. Staff stores
  const { data: staff } = await safeSupabaseFetch<any[]>(
    () => supabase.from('store_staff')
      .select('store_id')
      .eq('user_id', session.user.id)
      .limit(1)
  );

  if (staff && staff.length > 0) {
    return staff[0].store_id;
  }

  return null;
};
