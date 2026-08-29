import SubscriptionClientWrapper from './SubscriptionClientWrapper';
import { createClient } from '@/utils/supabase/server';
import { updateSubscriptionAction } from '@/app/actions/subscription';
import { UserSubscription, SubscriptionTier, SubscriptionDuration } from '@/types';

export default async function SubscriptionPage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  
  const userSubscription: UserSubscription = {
    tier: (profile?.subscription_tier as SubscriptionTier) || 'PRO',
    duration: (profile?.subscription_duration as SubscriptionDuration) || 'monthly',
    startDate: String(profile?.subscription_start_date || new Date().toISOString()),
    endDate: String(profile?.subscription_end_date || new Date().toISOString()),
    status: (profile?.subscription_status as UserSubscription['status']) || 'ACTIVE'
  };

  return (
    <SubscriptionClientWrapper
      currentSubscription={userSubscription}
      userRole={profile?.is_super_admin ? 'SUPER_ADMIN' : 'OWNER'}
      onUpdateSubscription={updateSubscriptionAction}
    />
  );
}
