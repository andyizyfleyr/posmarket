'use client';

import React, { useState, useEffect } from 'react';
import { SubscriptionView } from '@/views/SubscriptionView';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useRouter } from '@/components/RouterPolyfill';
import { UserSubscription, SubscriptionDuration, SubscriptionTier, NotificationType, StaffRole } from '@/types';

interface SubscriptionClientWrapperProps {
  currentSubscription: UserSubscription;
  onUpdateSubscription: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<{ success: boolean; error?: string | undefined }>;
  onCreatePayment?: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<{ success: boolean; error?: string | undefined; code?: string; paymentUrl?: string; transactionId?: string }>;
  paymentReturned?: boolean;
  userRole?: string;
}

export default function SubscriptionClientWrapper({ currentSubscription, onUpdateSubscription, onCreatePayment, paymentReturned, userRole }: SubscriptionClientWrapperProps) {
  const router = useRouter();
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const notify = (message: string, type: NotificationType, _title?: string) => {
    setToast({ message, type: type === 'error' ? 'error' : 'success' });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!paymentReturned) return;
    notify('Paiement reçu, votre abonnement est à jour.', 'success', 'Paiement');
    router.replace('/subscription', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentReturned]);

  return (
    <>
      <SubscriptionView
        currentSubscription={currentSubscription}
        userRole={userRole as StaffRole}
        onUpdateSubscription={onUpdateSubscription}
        onCreatePayment={onCreatePayment}
        notify={notify}
      />

      {toast && (
        <div className="fixed bottom-[88px] left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
          <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-2xl border ${
            toast.type === 'success'
              ? 'bg-green-600 text-white border-green-500'
              : 'bg-red-600 text-white border-red-500'
          }`}>
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span className="text-xs font-black tracking-tight whitespace-nowrap">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}