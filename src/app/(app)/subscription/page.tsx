import SubscriptionClientWrapper from './SubscriptionClientWrapper';
import { createClient } from '@/utils/supabase/server';
import { updateSubscriptionAction, createSubscriptionPaymentAction } from '@/app/actions/subscription';
import { syncFedaPaySubscriptions } from '@/lib/subscriptionSync';
import { UserSubscription, SubscriptionTier, SubscriptionDuration } from '@/types';

type SubscriptionSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function SubscriptionPage({ searchParams }: { searchParams: SubscriptionSearchParams }) {
  const sp = await searchParams;
  const returnedFromPayment = sp.fedapay === 'return';

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return null;

  if (returnedFromPayment) {
    try {
      await syncFedaPaySubscriptions(session.user.id);
    } catch (error) {
      console.error('Subscription reconciliation error:', error);
    }
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
  
  const userSubscription: UserSubscription = {
    tier: (profile?.subscription_tier as SubscriptionTier) || 'NONE',
    duration: (profile?.subscription_duration as SubscriptionDuration) || 'monthly',
    startDate: String(profile?.subscription_start_date || new Date().toISOString()),
    endDate: String(profile?.subscription_end_date || new Date().toISOString()),
    status: (profile?.subscription_status as UserSubscription['status']) || 'NONE'
  };

  return (
    <SubscriptionClientWrapper
      currentSubscription={userSubscription}
      userRole={profile?.is_super_admin ? 'SUPER_ADMIN' : 'OWNER'}
      onUpdateSubscription={updateSubscriptionAction}
      onCreatePayment={createSubscriptionPaymentAction}
      paymentReturned={returnedFromPayment}
    />
  );
}