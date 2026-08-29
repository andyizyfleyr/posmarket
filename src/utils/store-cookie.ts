import { cookies } from 'next/headers';
import { safeSupabaseFetch } from './supabase/retry';
import type { QueryBuilder } from '@/db/builder';

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

type SupabaseClientLike = { from: (table: string) => QueryBuilder };
type AuthSession = { user?: { id?: string } | null } | null;

export const getEffectiveStoreId = async (supabase: SupabaseClientLike, session: AuthSession): Promise<string | null> => {
  const userId = session?.user?.id;
  if (!userId) return null;
  
  const currentId = await getStoreCookie();
  
  // If we have a cookie, we MUST verify the user has access to it
  if (currentId) {
    // 1. Check owner + staff in parallel
    const [ownerRes, staffRes] = await Promise.all([
      supabase.from('stores')
        .select('id')
        .eq('id', currentId)
        .eq('user_id', userId)
        .single(),
      supabase.from('store_staff')
        .select('id')
        .eq('store_id', currentId)
        .eq('user_id', userId)
        .single()
    ]);

    if (ownerRes.data || staffRes.data) return currentId;
  }

  // Fallback to finding ANY store they have access to
  // 1. Owned stores
  const { data: owned } = await safeSupabaseFetch<{ id: string }[]>(
    () => supabase.from('stores')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
  );
  
  if (owned && owned.length > 0) {
    return owned[0].id;
  }

  // 2. Staff stores
  const { data: staff } = await safeSupabaseFetch<{ store_id: string }[]>(
    () => supabase.from('store_staff')
      .select('store_id')
      .eq('user_id', userId)
      .limit(1)
  );

  if (staff && staff.length > 0) {
    return staff[0].store_id;
  }

  return null;
};
