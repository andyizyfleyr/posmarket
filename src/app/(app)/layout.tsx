import { createClient } from '@/utils/supabase/server';
import { redirect } from 'next/navigation';
import { getStoreCookie } from '@/utils/store-cookie';
import LayoutClientWrapper from '@/components/LayoutClientWrapper';
import { StoreData, SubscriptionTier, SubscriptionDuration, StaffRole, UserSubscription } from '@/types';
import { SUBSCRIPTION_PLANS } from '@/constants';
import { safeSupabaseFetch } from '@/utils/supabase/retry';

interface ProfileData {
  id: string;
  email?: string | null;
  full_name?: string | null;
  is_super_admin?: boolean | null;
  subscription_tier?: string | null;
  subscription_duration?: string | null;
  subscription_start_date?: string | null;
  subscription_end_date?: string | null;
  subscription_status?: string | null;
}

interface StoreRowData {
  id: string;
  user_id?: string | null;
  name?: string | null;
  slug?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  ninea?: string | null;
  description?: string | null;
  logo?: string | null;
  theme?: string | null;
  business_type?: string | null;
  status?: string | null;
  views?: number | null;
  settings?: unknown;
  created_at?: string | null;
}

interface StaffEntryData {
  id: string;
  store_id: string;
  role: string;
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  console.log('[Layout] Entering AppLayout...');
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    console.log('[Layout] No user found, redirecting to /login');
    redirect('/login');
  }

  console.log(`[Layout] User authenticated: ${user.id}. Fetching profile...`);

  // Fetch basic profile + stores + staff entries in parallel
  const [profileRes, ownedStoresRes, staffEntriesRes] = await Promise.all([
    safeSupabaseFetch<ProfileData>(
      () => supabase.from('profiles').select('*').eq('id', user.id).single()
    ),
    safeSupabaseFetch<StoreRowData[]>(
      () => supabase.from('stores').select('*').eq('user_id', user.id)
    ),
    safeSupabaseFetch<StaffEntryData[]>(
      () => supabase.from('store_staff').select('id, store_id, role').eq('user_id', user.id)
    )
  ]);

  const { data: profile } = profileRes;
  const { data: ownedStores } = ownedStoresRes;
  const { data: staffEntries } = staffEntriesRes;

  const userSubscription: UserSubscription = {
    tier: (profile?.subscription_tier as SubscriptionTier) || 'PRO',
    duration: (profile?.subscription_duration as SubscriptionDuration) || 'monthly',
    startDate: profile?.subscription_start_date || new Date().toISOString(),
    endDate: profile?.subscription_end_date || new Date().toISOString(),
    status: (profile?.subscription_status as UserSubscription['status']) || 'ACTIVE'
  };

  const currentPlan = SUBSCRIPTION_PLANS[userSubscription.tier as keyof typeof SUBSCRIPTION_PLANS] || SUBSCRIPTION_PLANS.PRO;

  const staffStoreIds = staffEntries?.map(s => s.store_id) || [];

  let staffStores: StoreRowData[] = [];
  if (staffStoreIds.length > 0) {
    console.log(`[Layout] Fetching ${staffStoreIds.length} staff stores...`);
    const { data } = await safeSupabaseFetch<StoreRowData[]>(
       () => supabase.from('stores').select('*').in('id', staffStoreIds)
    );
    staffStores = data || [];
  }

  const allRawStores = [
    ...(ownedStores || []),
    ...(staffStores || [])
  ]
  .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i) // Deduplicate
  .sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()); // Ensure oldest first

  const stores = allRawStores.map(s => {
    const staffEntry = staffEntries?.find(entry => entry.store_id === s.id);
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      status: s.status,
      description: s.description || (s.settings as Record<string, unknown>)?.description || '',
      ownerId: s.user_id,
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

  console.log(`[Layout] Fetched ${stores.length} stores for user ${user.id}`);

  let currentStoreId = await getStoreCookie();

  if (stores.length > 0) {
    const exists = stores.find(s => s.id === currentStoreId);
    if (!exists) {
      currentStoreId = stores[0].id;
    }
  }

  const currentStore = stores.find(s => s.id === currentStoreId) || stores[0] || null;

  let currentUserRole: StaffRole = 'OWNER';
  if (profile?.is_super_admin) {
    currentUserRole = 'SUPER_ADMIN';
  } else if (currentStore) {
    if (currentStore.ownerId !== user.id) {
        const staffInThisStore = staffEntries?.find(st => st.store_id === currentStore.id);
        if (staffInThisStore) currentUserRole = staffInThisStore.role as StaffRole;
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
