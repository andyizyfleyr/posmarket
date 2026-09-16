'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { SubscriptionView } from '@/views/SubscriptionView';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { UserSubscription, SubscriptionDuration, SubscriptionTier, NotificationType, StaffRole } from '@/types';

interface SubscriptionClientWrapperProps {
  currentSubscription: UserSubscription;
  onUpdateSubscription: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<{ success: boolean; error?: string | undefined }>;
  onCreatePayment?: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<{ success: boolean; error?: string | undefined; code?: string; paymentUrl?: string }>;
  onReconcilePayments?: () => Promise<{ success: boolean; error?: string | undefined; activated?: number; updated?: number }>;
  userRole?: string;
}

export default function SubscriptionClientWrapper({ currentSubscription, onUpdateSubscription, onCreatePayment, onReconcilePayments, userRole }: SubscriptionClientWrapperProps) {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const reconciled = useRef(false);

  const notify = useCallback((message: string, type: NotificationType, _title?: string) => {
    setToast({ message, type: type === 'error' ? 'error' : 'success' });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    if (reconciled.current || !onReconcilePayments) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('fedapay') !== 'return') return;
    reconciled.current = true;

    onReconcilePayments()
      .then((result) => {
        if (result.success) {
          if (result.activated && result.activated > 0) {
            notify('Paiement confirmé ! Votre abonnement a été activé.', 'success', 'Succès');
          } else {
            notify('Retour du paiement reçu. L\'activation sera confirmée sous peu.', 'success', 'Paiement');
          }
        } else {
          notify(result.error || 'Impossible de confirmer votre paiement', 'error', 'Paiement');
        }
        window.location.replace('/subscription');
      })
      .catch(() => {
        notify('Impossible de confirmer votre paiement', 'error', 'Paiement');
        window.location.replace('/subscription');
      });
  }, [onReconcilePayments, notify]);

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
