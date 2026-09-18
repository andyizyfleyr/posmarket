'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SubscriptionView } from '@/views/SubscriptionView';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
import { useRouter } from '@/components/RouterPolyfill';
import { useKkiapay } from '@/hooks/useKkiapay';
import { useFedapay } from '@/hooks/useFedapay';
import {
  UserSubscription,
  SubscriptionDuration,
  SubscriptionTier,
  NotificationType,
  StaffRole,
} from '@/types';
import { confirmKkiapayPaymentAction } from '@/app/actions/subscription';

interface SubscriptionClientWrapperProps {
  currentSubscription: UserSubscription;
  onUpdateSubscription: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<{ success: boolean; error?: string | undefined }>;
  onCreatePayment?: (tier: SubscriptionTier, duration: SubscriptionDuration) => Promise<{ success: boolean; error?: string | undefined; code?: string; paymentUrl?: string; transactionId?: string; amount?: number }>;
  onConfirmPayment?: (transactionId: string, kkiapayTransactionId: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  kkiapayPublicKey?: string;
  kkiapayEnv?: 'sandbox' | 'live';
  fedapayPublicKey?: string;
  fedapayEnv?: 'sandbox' | 'live';
  paymentProvider?: 'kkiapay' | 'fedapay';
  userName?: string;
  userEmail?: string;
  userPhone?: string;
  paymentReturned?: boolean;
  userRole?: string;
}

export default function SubscriptionClientWrapper({
  currentSubscription,
  onUpdateSubscription,
  onCreatePayment,
  onConfirmPayment = confirmKkiapayPaymentAction,
  kkiapayPublicKey,
  kkiapayEnv = 'sandbox',
  fedapayPublicKey,
  fedapayEnv = 'sandbox',
  paymentProvider = 'kkiapay',
  userName = '',
  userEmail = '',
  userPhone = '',
  paymentReturned,
  userRole,
}: SubscriptionClientWrapperProps) {
  const router = useRouter();
  const { ready: kkiapayReady, openWidget: openKkiapay } = useKkiapay();
  const { ready: fedapayReady, openWidget: openFedapay } = useFedapay();
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

  const handlePay = useCallback(async (tier: SubscriptionTier, duration: SubscriptionDuration): Promise<{ success: boolean; error?: string }> => {
    if (!onCreatePayment) {
      const direct = await onUpdateSubscription(tier, duration);
      if (direct.success) {
        notify(`Abonnement activé avec succès !`, 'success', 'Succès');
        router.refresh();
      } else {
        notify(direct.error || 'Erreur lors de l\'activation', 'error', 'Erreur');
      }
      return direct;
    }

    const res = await onCreatePayment(tier, duration);

    if (!res.success) {
      notify(res.error || 'Erreur lors de l\'initialisation du paiement', 'error', 'Paiement');
      return { success: false, error: res.error };
    }

    if (!res.transactionId || !res.amount) {
      notify('Facture de paiement invalide.', 'error', 'Paiement');
      return { success: false };
    }
    if (paymentProvider === 'fedapay') {
      if (!fedapayPublicKey) {
        notify('Le paiement FedaPay n\'est pas configuré.', 'error', 'Paiement');
        return { success: false };
      }
      if (!fedapayReady) {
        notify('Module FedaPay encore en chargement, réessayez.', 'error', 'Paiement');
        return { success: false };
      }
      openFedapay({
        publicKey: fedapayPublicKey,
        amount: res.amount,
        description: `Abonnement ${tier} - ${duration} (ref: ${res.transactionId})`,
        environment: fedapayEnv === 'live' ? 'live' : 'sandbox',
        customer: {
          email: userEmail,
          firstname: userName ? userName.split(' ')[0] : '',
          lastname: userName ? userName.split(' ').slice(1).join(' ') : '',
        },
        onSuccess: async (tx: unknown) => {
          try {
            const txObj = tx as { id?: number; reference?: string; status?: string };
            const fTxId = txObj.id || txObj.reference || '';
            const confirm = await onConfirmPayment(res.transactionId!, String(fTxId));
            if (confirm.success) {
              notify('Paiement FedaPay confirmé. Abonnement activé.', 'success', 'Abonnement');
              router.refresh();
            } else {
              notify(confirm.error || 'Le paiement n\'a pas été confirmé.', 'error', 'Paiement');
              router.refresh();
            }
          } catch {
            notify('Erreur lors de la confirmation du paiement.', 'error', 'Paiement');
          }
        },
        onFailed: () => {
          notify('Le paiement FedaPay a été annulé ou a échoué.', 'error', 'Paiement');
        },
      });
    } else {
      if (!kkiapayPublicKey) {
        notify('Le paiement Kkiapay n\'est pas configuré.', 'error', 'Paiement');
        return { success: false };
      }
      if (!kkiapayReady) {
        notify('Module de paiement encore en chargement, réessayez.', 'error', 'Paiement');
        return { success: false };
      }
      openKkiapay({
        amount: res.amount,
        key: kkiapayPublicKey,
        sandbox: kkiapayEnv === 'sandbox',
        partnerId: res.transactionId,
        data: JSON.stringify({ tier, duration }),
        name: userName,
        email: userEmail,
        phone: userPhone,
        onSuccess: async (kTxId: string) => {
          try {
            const confirm = await onConfirmPayment(res.transactionId!, kTxId);
            if (confirm.success) {
              notify('Paiement confirmé. Abonnement activé.', 'success', 'Abonnement');
              router.refresh();
            } else {
              notify(confirm.error || 'Le paiement n\'a pas été confirmé.', 'error', 'Paiement');
              router.refresh();
            }
          } catch {
            notify('Erreur lors de la confirmation du paiement.', 'error', 'Paiement');
          }
        },
        onFailed: () => {
          notify('Le paiement a été annulé ou a échoué.', 'error', 'Paiement');
        },
      });
    }

    return { success: true };
  }, [onCreatePayment, onUpdateSubscription, kkiapayPublicKey, kkiapayEnv, kkiapayReady, openKkiapay, fedapayPublicKey, fedapayEnv, fedapayReady, openFedapay, paymentProvider, userName, userEmail, userPhone, onConfirmPayment, router, notify]);

  return (
    <>
      <SubscriptionView
        currentSubscription={currentSubscription}
        userRole={userRole as StaffRole}
        onUpdateSubscription={onUpdateSubscription}
        onPay={handlePay}
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