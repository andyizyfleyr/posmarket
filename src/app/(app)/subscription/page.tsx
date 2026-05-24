import { SubscriptionView } from '@/views/SubscriptionView';
import { createClient } from '@/utils/supabase/server';
import { updateSubscriptionAction } from '@/app/actions/subscription';

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  
  const userSubscription = {
    tier: profile?.subscription_tier || 'PRO',
    duration: profile?.subscription_duration || 'monthly',
    startDate: profile?.subscription_start_date || new Date().toISOString(),
    endDate: profile?.subscription_end_date || new Date().toISOString(),
    status: profile?.subscription_status || 'ACTIVE'
  };

  return (
    <SubscriptionView 
      currentSubscription={userSubscription as any}
      userRole={profile?.is_super_admin ? 'SUPER_ADMIN' : 'OWNER'}
      onUpdateSubscription={updateSubscriptionAction}
    />
  );
}

