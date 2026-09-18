'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { SubscriptionView } from '@/views/SubscriptionView';
import { useRouter } from '@/components/RouterPolyfill';
import { useKkiapay } from '@/hooks/useKkiapay';
import { useFedapay } from '@/hooks/useFedapay';
import { TransactionResultModal, TransactionModalData } from '@/components/TransactionResultModal';
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

  const [modalData, setModalData] = useState<TransactionModalData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [lastAttempt, setLastAttempt] = useState<{ tier: SubscriptionTier; duration: SubscriptionDuration } | null>(null);

  useEffect(() => {
    if (!paymentReturned) return;
    setModalData({
      status: 'success',
      title: 'Paiement Confirmé !',
      message: 'Votre paiement a été reçu et votre abonnement est maintenant actif.',
      date: new Date(),
    });
    setIsModalOpen(true);
    router.replace('/subscription', { scroll: false });
  }, [paymentReturned, router]);

  const handlePay = useCallback(async (tier: SubscriptionTier, duration: SubscriptionDuration): Promise<{ success: boolean; error?: string }> => {
    setLastAttempt({ tier, duration });

    if (!onCreatePayment) {
      const direct = await onUpdateSubscription(tier, duration);
      if (direct.success) {
        setModalData({
          status: 'success',
          title: 'Abonnement Activé !',
          message: `Votre formule ${tier} a été activée avec succès.`,
          tier,
          duration,
          date: new Date(),
        });
        setIsModalOpen(true);
        router.refresh();
      } else {
        setModalData({
          status: 'error',
          title: 'Erreur d\'activation',
          message: direct.error || 'Impossible d\'activer l\'abonnement.',
          tier,
          duration,
          date: new Date(),
        });
        setIsModalOpen(true);
      }
      return direct;
    }

    const res = await onCreatePayment(tier, duration);

    if (!res.success) {
      setModalData({
        status: 'error',
        title: 'Initialisation Échouée',
        message: res.error || 'Impossible de créer la facture de paiement.',
        tier,
        duration,
        date: new Date(),
      });
      setIsModalOpen(true);
      return { success: false, error: res.error };
    }

    if (!res.transactionId || !res.amount) {
      setModalData({
        status: 'error',
        title: 'Facture Invalide',
        message: 'Les données de transaction sont incomplètes.',
        tier,
        duration,
        date: new Date(),
      });
      setIsModalOpen(true);
      return { success: false };
    }

    if (paymentProvider === 'fedapay') {
      if (!fedapayPublicKey) {
        setModalData({
          status: 'error',
          title: 'Configuration Manquante',
          message: 'Le paiement FedaPay n\'est pas configuré par l\'administrateur.',
          tier,
          duration,
          amount: res.amount,
          date: new Date(),
        });
        setIsModalOpen(true);
        return { success: false };
      }
      if (!fedapayReady) {
        setModalData({
          status: 'error',
          title: 'Module en Chargement',
          message: 'Le module de paiement FedaPay est encore en cours de chargement. Veuillez patienter un instant et réessayer.',
          tier,
          duration,
          amount: res.amount,
          date: new Date(),
        });
        setIsModalOpen(true);
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
            const raw = (tx as Record<string, unknown>) || {};
            const txObj = ((raw.transaction || raw) as { id?: number | string; reference?: string; status?: string }) || {};
            const fTxId = String(txObj.id || txObj.reference || raw.id || raw.reference || '').trim();

            if (!fTxId) {
              setModalData({
                status: 'error',
                title: 'Référence Introuvable',
                message: 'Impossible de récupérer l\'identifiant de transaction FedaPay.',
                amount: res.amount,
                tier,
                duration,
                transactionId: res.transactionId,
                provider: 'fedapay',
                date: new Date(),
              });
              setIsModalOpen(true);
              return;
            }

            const confirm = await onConfirmPayment(res.transactionId!, fTxId);
            if (confirm.success) {
              setModalData({
                status: 'success',
                title: 'Paiement Réussi !',
                message: `Votre abonnement ${tier} (${duration === 'annual' ? 'Annuel' : duration === 'quarterly' ? 'Trimestriel' : 'Mensuel'}) est désormais actif.`,
                amount: res.amount,
                currency: 'FCFA',
                tier,
                duration,
                transactionId: res.transactionId,
                reference: fTxId,
                provider: 'fedapay',
                date: new Date(),
              });
              setIsModalOpen(true);
              router.refresh();
            } else {
              setModalData({
                status: 'error',
                title: 'Paiement Non Confirmé',
                message: confirm.error || 'Le paiement n\'a pas pu être validé par FedaPay.',
                amount: res.amount,
                currency: 'FCFA',
                tier,
                duration,
                transactionId: res.transactionId,
                reference: fTxId,
                provider: 'fedapay',
                date: new Date(),
              });
              setIsModalOpen(true);
              router.refresh();
            }
          } catch (err) {
            console.error('[FedaPay onConfirmPayment] Error:', err);
            setModalData({
              status: 'error',
              title: 'Erreur de Confirmation',
              message: 'Une erreur est survenue lors de la validation de votre paiement.',
              amount: res.amount,
              tier,
              duration,
              transactionId: res.transactionId,
              provider: 'fedapay',
              date: new Date(),
            });
            setIsModalOpen(true);
          }
        },
        onFailed: (err?: unknown) => {
          console.warn('[FedaPay] onFailed error:', err);
          const e = err as { reason?: string; message?: string } | undefined;
          if (e?.reason === 'dismissed' || e?.message === 'Paiement annulé') {
            setModalData({
              status: 'cancelled',
              title: 'Paiement Annulé',
              message: 'Vous avez fermé le guichet de paiement sans finaliser la transaction.',
              amount: res.amount,
              tier,
              duration,
              transactionId: res.transactionId,
              provider: 'fedapay',
              date: new Date(),
            });
          } else {
            setModalData({
              status: 'error',
              title: 'Paiement Non Abouti',
              message: e?.message || 'La transaction a été refusée ou interrompue.',
              amount: res.amount,
              tier,
              duration,
              transactionId: res.transactionId,
              provider: 'fedapay',
              date: new Date(),
            });
          }
          setIsModalOpen(true);
        },
      });
    } else {
      if (!kkiapayPublicKey) {
        setModalData({
          status: 'error',
          title: 'Configuration Manquante',
          message: 'Le paiement Kkiapay n\'est pas configuré par l\'administrateur.',
          tier,
          duration,
          amount: res.amount,
          date: new Date(),
        });
        setIsModalOpen(true);
        return { success: false };
      }
      if (!kkiapayReady) {
        setModalData({
          status: 'error',
          title: 'Module en Chargement',
          message: 'Le module de paiement Kkiapay est encore en cours de chargement.',
          tier,
          duration,
          amount: res.amount,
          date: new Date(),
        });
        setIsModalOpen(true);
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
              setModalData({
                status: 'success',
                title: 'Paiement Réussi !',
                message: `Votre abonnement ${tier} (${duration === 'annual' ? 'Annuel' : duration === 'quarterly' ? 'Trimestriel' : 'Mensuel'}) est activé.`,
                amount: res.amount,
                currency: 'FCFA',
                tier,
                duration,
                transactionId: res.transactionId,
                reference: kTxId,
                provider: 'kkiapay',
                date: new Date(),
              });
              setIsModalOpen(true);
              router.refresh();
            } else {
              setModalData({
                status: 'error',
                title: 'Paiement Non Confirmé',
                message: confirm.error || 'Le paiement n\'a pas pu être validé par Kkiapay.',
                amount: res.amount,
                currency: 'FCFA',
                tier,
                duration,
                transactionId: res.transactionId,
                reference: kTxId,
                provider: 'kkiapay',
                date: new Date(),
              });
              setIsModalOpen(true);
              router.refresh();
            }
          } catch {
            setModalData({
              status: 'error',
              title: 'Erreur de Confirmation',
              message: 'Une erreur est survenue lors de la confirmation du paiement Kkiapay.',
              amount: res.amount,
              tier,
              duration,
              transactionId: res.transactionId,
              provider: 'kkiapay',
              date: new Date(),
            });
            setIsModalOpen(true);
          }
        },
        onFailed: () => {
          setModalData({
            status: 'cancelled',
            title: 'Paiement Interrompu',
            message: 'La session de paiement Kkiapay a été annulée ou n\'a pas abouti.',
            amount: res.amount,
            tier,
            duration,
            transactionId: res.transactionId,
            provider: 'kkiapay',
            date: new Date(),
          });
          setIsModalOpen(true);
        },
      });
    }

    return { success: true };
  }, [onCreatePayment, onUpdateSubscription, kkiapayPublicKey, kkiapayEnv, kkiapayReady, openKkiapay, fedapayPublicKey, fedapayEnv, fedapayReady, openFedapay, paymentProvider, userName, userEmail, userPhone, onConfirmPayment, router]);

  return (
    <>
      <SubscriptionView
        currentSubscription={currentSubscription}
        userRole={userRole as StaffRole}
        onUpdateSubscription={onUpdateSubscription}
        onPay={handlePay}
      />

      <TransactionResultModal
        isOpen={isModalOpen}
        data={modalData}
        onClose={() => {
          setIsModalOpen(false);
          router.refresh();
        }}
        onRetry={lastAttempt ? () => {
          setIsModalOpen(false);
          handlePay(lastAttempt.tier, lastAttempt.duration);
        } : undefined}
      />
    </>
  );
}