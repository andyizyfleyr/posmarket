import SubscriptionClientWrapper from './SubscriptionClientWrapper';
import { createClient } from '@/utils/supabase/server';
import { updateSubscriptionAction, createSubscriptionPaymentAction, confirmKkiapayPaymentAction, confirmFedapayPaymentAction } from '@/app/actions/subscription';
import { syncKkiapaySubscriptions } from '@/lib/subscriptionSync';
import { loadPaymentConfig } from '@/lib/paymentConfig';
import { UserSubscription, SubscriptionTier, SubscriptionDuration } from '@/types';

type SubscriptionSearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function SubscriptionPage({ searchParams }: { searchParams: SubscriptionSearchParams }) {
  const sp = await searchParams;
  const returnedFromPayment = sp.returned === '1' || sp.kkiapay === 'return' || sp.fedapay === 'return';

  const config = await loadPaymentConfig();

  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) return null;

  if (returnedFromPayment) {
    try {
      await syncKkiapaySubscriptions(session.user.id);
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
      onConfirmPayment={config.provider === 'fedapay' ? confirmFedapayPaymentAction : confirmKkiapayPaymentAction}
      kkiapayPublicKey={config.kkiapayPublicKey || ''}
      kkiapayEnv={config.kkiapayEnv || 'sandbox'}
      fedapayPublicKey={config.fedapayPublicKey || ''}
      fedapayEnv={config.fedapayEnv || 'sandbox'}
      paymentProvider={config.provider}
      userName={profile?.full_name ? String(profile.full_name) : ''}
      userEmail={String(profile?.email ?? session.user.email ?? '')}
      userPhone={profile?.phone ? String(profile.phone) : ''}
      paymentReturned={returnedFromPayment}
    />
  );
}
