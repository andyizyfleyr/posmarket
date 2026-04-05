import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getStoreCookie, setStoreCookie } from '@/utils/store-cookie';
import LayoutClientWrapper from '@/components/LayoutClientWrapper';
import { StoreData, SubscriptionPlan, SubscriptionTier } from '@/types';
import { SUBSCRIPTION_PLANS, DEFAULT_STORE_SETTINGS } from '@/constants';
import { safeSupabaseFetch } from '@/utils/supabase/retry';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  console.log('[Layout] Entering AppLayout...');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log('[Layout] No user found, redirecting to /login');
    redirect('/login');
  }

  console.log(`[Layout] User authenticated: ${user.id}. Fetching profile...`);

  // Fetch basic profile
  const { data: profile } = await safeSupabaseFetch<any>(
    () => supabase.from('profiles').select('*').eq('id', user.id).single()
  );

  const userSubscription = {
    tier: (profile?.subscription_tier as SubscriptionTier) || 'BASIC',
    duration: profile?.subscription_duration || 'monthly',
    startDate: profile?.subscription_start_date || new Date().toISOString(),
    endDate: profile?.subscription_end_date || new Date().toISOString(), // Default to now (expired if BASIC)
    status: profile?.subscription_status || 'EXPIRED' // Default to EXPIRED
  } as any;

  const currentPlan = SUBSCRIPTION_PLANS[userSubscription.tier as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.BASIC;

  // Fetch stores that this user owns or staff in
  console.log('[Layout] Fetching stores...');
  const { data: ownedStores } = await safeSupabaseFetch<any[]>(
    () => supabase.from('stores').select('*').eq('user_id', user.id)
  );

  console.log('[Layout] Fetching staff entries...');
  const { data: staffEntries } = await safeSupabaseFetch<any[]>(
    () => supabase.from('store_staff').select('id, store_id, role').eq('user_id', user.id)
  );

  const staffStoreIds = staffEntries?.map(s => s.store_id) || [];

  let staffStores: any[] = [];
  if (staffStoreIds.length > 0) {
    console.log(`[Layout] Fetching ${staffStoreIds.length} staff stores...`);
    const { data } = await safeSupabaseFetch<any[]>(
       () => supabase.from('stores').select('*').in('id', staffStoreIds)
    );
    staffStores = data || [];
  }

  const allRawStores = [
    ...(ownedStores || []),
    ...(staffStores || [])
  ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i); // Deduplicate

  const stores = allRawStores.map(s => {
    const staffEntry = staffEntries?.find(entry => entry.store_id === s.id);
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      status: s.status,
      description: s.description || (s.settings as any)?.description || '',
      ownerId: s.user_id,
      views: s.views || 0,
      settings: { 
        name: s.name, 
        email: s.email || '', 
        phone: s.phone || '', 
        address: s.address || '', 
        ninea: s.ninea || '',
        ...s.settings // Merge with JSONB settings if exists
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

  console.log(`[Layout] Fetched ${stores.length} stores for user ${user.id}`);

  let currentStoreId = await getStoreCookie();

  if (stores.length > 0) {
    const exists = stores.find(s => s.id === currentStoreId);
    if (!exists) {
      currentStoreId = stores[0].id;
    }
  }

  const currentStore = stores.find(s => s.id === currentStoreId) || stores[0] || null;

  let currentUserRole: any = 'OWNER';
  if (profile?.isSuperAdmin) {
    currentUserRole = 'SUPER_ADMIN';
  } else if (currentStore) {
    if (currentStore.ownerId !== user.id) {
        const staffInThisStore = staffEntries?.find(st => st.store_id === currentStore.id);
        if (staffInThisStore) currentUserRole = staffInThisStore.role;
    }
  }

  return (
    <LayoutClientWrapper
      stores={stores}
      currentStore={currentStore}
      currentPlan={currentPlan}
      userEmail={user.email!}
      userSubscription={userSubscription}
      currentUserRole={currentUserRole}
    >
      {children}
    </LayoutClientWrapper>
  );
}
