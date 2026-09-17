import { redirect } from 'next/navigation';
import { db } from '@/db';
import { subscriptionPayments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createClient } from '@/utils/supabase/server';
import { getSubscriptionPlan } from '@/constants';
import { PAYDUNYA_ENV, paydunyaConfigured } from '@/lib/paydunya';
import { PaymentClient } from './PaymentClient';
import type { SubscriptionTier, SubscriptionDuration } from '@/types';

type PaymentPageParams = Promise<{ id: string }>;

function durationLabel(duration: string): string {
  if (duration === 'monthly') return 'Mensuel';
  if (duration === 'quarterly') return 'Trimestriel';
  if (duration === 'annual') return 'Annuel';
  return duration;
}

export const metadata = {
  title: 'Paiement | PosMarket',
  robots: { index: false, follow: false },
};

export default async function PaymentPage({ params }: { params: PaymentPageParams }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const rows = await db
    .select()
    .from(subscriptionPayments)
    .where(
      and(
        eq(subscriptionPayments.transactionId, id),
        eq(subscriptionPayments.userId, user.id)
      )
    )
    .limit(1);

  const payment = rows[0];
  if (!payment || payment.status !== 'PENDING') {
    redirect('/subscription');
  }

  const plan = getSubscriptionPlan(payment.tier as SubscriptionTier);

  if (!paydunyaConfigured()) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 text-center">
          <h1 className="text-lg md:text-xl font-black text-slate-900 mb-2">Paiement indisponible</h1>
          <p className="text-xs md:text-sm text-slate-500 mb-6">
            Le module de paiement en ligne n&apos;est pas encore configuré. Contactez l&apos;administrateur de la plateforme.
          </p>
          <a
            href="/subscription"
            className="inline-block bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-2.5 px-5 rounded-xl transition-colors"
          >
            Retour à l&apos;abonnement
          </a>
        </div>
      </div>
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, email, phone')
    .eq('id', user.id)
    .single();

  return (
    <PaymentClient
      transactionId={id}
      planName={plan?.name || payment.tier}
      amount={payment.amount}
      environment={PAYDUNYA_ENV}
      durationLabel={durationLabel(String(payment.duration))}
      userName={profile?.full_name ? String(profile.full_name) : ''}
      userEmail={(profile?.email ? String(profile.email) : '') || user.email || ''}
      userPhone={profile?.phone ? String(profile.phone) : ''}
    />
  );
}