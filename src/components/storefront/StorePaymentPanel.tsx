'use client';

import React, { useState } from 'react';
import { CheckCircle2, CreditCard, Loader2, Phone, RefreshCw, Smartphone, Truck, XCircle } from 'lucide-react';
import { useKkiapay } from '@/hooks/useKkiapay';
import { useFedapay } from '@/hooks/useFedapay';
import { useFeexpay } from '@/hooks/useFeexpay';
import {
  confirmStorePaymentAction,
  refreshStorePaymentAction,
} from '@/app/actions/storePayments';
import type { NotificationType } from '@/types';

/** Moyens de paiement en ligne lançables immédiatement (le reste n'enclenche rien). */
export const STORE_ONLINE_PROVIDERS = new Set(['kkiapay', 'fedapay', 'feexpay', 'saspay']);
export const isOnlineProvider = (provider: string): boolean => STORE_ONLINE_PROVIDERS.has(provider);

/** Vue client d'un paiement boutique renvoyée par l'action checkout. */
export type StoreCheckoutPaymentView = {
  id: string;
  orderId: string;
  storeId: string;
  provider: string;
  providerLabel: string;
  amount: number;
  currency: string;
  status: string;
  token: string;
  checkoutUrl: string | null;
  publicKey: string | null;
  /** Identifiant public de la boutique FeexPay (guichet SDK). */
  shopId?: string | null;
  env: 'sandbox' | 'live';
  ussdCode: string | null;
  instructions: string | null;
  reference: string | null;
  error: string | null;
};

interface Props {
  payments: StoreCheckoutPaymentView[];
  customer: { name?: string | null; email?: string | null; phone?: string | null };
  formatCurrency: (n: number) => string;
  notify?: (msg: string, type: NotificationType) => void;
}

function ProviderIcon({ provider }: { provider: string }) {
  const cls = 'text-brand shrink-0';
  switch (provider) {
    case 'cod':
      return <Truck size={18} className={cls} />;
    case 'ussd':
      return <Phone size={18} className={cls} />;
    case 'saspay':
      return <CreditCard size={18} className={cls} />;
    default:
      return <Smartphone size={18} className={cls} />;
  }
}

function PaymentCard({
  payment,
  customer,
  formatCurrency,
  notify,
}: {
  payment: StoreCheckoutPaymentView;
  customer: Props['customer'];
  formatCurrency: (n: number) => string;
  notify?: Props['notify'];
}) {
  const [status, setStatus] = useState(payment.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(payment.error);
  const kkiapay = useKkiapay();
  const fedapay = useFedapay();
  const feexpay = useFeexpay();

  const applyResult = (res: { success: boolean; status?: string; error?: string }) => {
    const ok = Boolean(res.success || res.status === 'PAID');
    if (ok) {
      setStatus('PAID');
      setError(null);
      notify?.('Paiement confirmé, merci !', 'success');
    } else {
      if (res.status) setStatus(res.status);
      setError(res.error || 'Paiement non abouti.');
      notify?.(res.error || 'Paiement non abouti.', 'error');
    }
  };

  const payKkiapay = () => {
    if (!payment.publicKey) {
      setError('Paiement Kkiapay indisponible pour cette boutique.');
      return;
    }
    setBusy(true);
    setError(null);
    kkiapay.openWidget({
      amount: Math.round(payment.amount),
      key: payment.publicKey,
      sandbox: payment.env !== 'live',
      partnerId: payment.token,
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      onSuccess: async (transactionId) => {
        try {
          applyResult(await confirmStorePaymentAction(payment.orderId, payment.token, transactionId));
        } finally {
          setBusy(false);
        }
      },
      onFailed: () => {
        setBusy(false);
        setError('Paiement annulé ou non abouti.');
      },
    });
  };

  const payFedapay = () => {
    if (!payment.publicKey) {
      setError('Paiement FedaPay indisponible pour cette boutique.');
      return;
    }
    setBusy(true);
    setError(null);
    fedapay.openWidget({
      publicKey: payment.publicKey,
      amount: Math.round(payment.amount),
      description: `Commande boutique:${payment.token}`,
      environment: payment.env,
      customer: {
        email: customer.email || 'client@posmarket.com',
        firstname: customer.name || 'Client',
        lastname: 'PosMarket',
      },
      onSuccess: async (tx) => {
        try {
          const reference = tx.id ? String(tx.id) : tx.reference ? String(tx.reference) : '';
          applyResult(await confirmStorePaymentAction(payment.orderId, payment.token, reference));
        } finally {
          setBusy(false);
        }
      },
      onFailed: () => {
        setBusy(false);
        setError('Paiement annulé ou non abouti.');
      },
    });
  };

  const payFeexpay = () => {
    if (!payment.publicKey || !payment.shopId) {
      setError('Paiement FeexPay indisponible pour cette boutique.');
      return;
    }
    setBusy(true);
    setError(null);
    feexpay.openWidget({
      shopId: payment.shopId,
      token: payment.publicKey,
      amount: Math.round(payment.amount),
      mode: payment.env === 'live' ? 'LIVE' : 'SANDBOX',
      description: 'Commande PosMarket',
      callbackInfo: payment.token,
      onSuccess: async (res) => {
        try {
          const reference = String(res?.reference || res?.transaction_id || '');
          applyResult(await confirmStorePaymentAction(payment.orderId, payment.token, reference));
        } finally {
          setBusy(false);
        }
      },
      onFailed: () => {
        setBusy(false);
        setError('Paiement annulé ou non abouti.');
      },
    });
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      applyResult(await refreshStorePaymentAction(payment.orderId, payment.token));
    } finally {
      setBusy(false);
    }
  };

  const isPaid = status === 'PAID';
  const isFailed = status === 'FAILED';

  return (
    <div
      className={`w-full max-w-md rounded-2xl border p-4 text-left space-y-3 ${
        isPaid
          ? 'border-green-200 bg-green-50'
          : isFailed
            ? 'border-red-200 bg-red-50'
            : 'border-gray-100 bg-white shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ProviderIcon provider={payment.provider} />
          <span className="text-xs md:text-sm font-bold text-gray-900 truncate">{payment.providerLabel}</span>
        </div>
        <span className="text-xs md:text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">
          {formatCurrency(payment.amount)}
        </span>
      </div>

      {isPaid ? (
        <p className="flex items-center gap-2 text-xs font-bold text-green-700">
          <CheckCircle2 size={16} /> Paiement confirmé
          {payment.reference ? ` · réf. ${payment.reference}` : ''}
        </p>
      ) : isFailed ? (
        <p className="flex items-start gap-2 text-xs font-semibold text-red-600">
          <XCircle size={16} className="shrink-0 mt-0.5" />
          {error || 'Ce paiement n’a pas abouti. Contactez la boutique pour réessayer.'}
        </p>
      ) : (
        <>
          {payment.provider === 'cod' && (
            <p className="text-xs font-semibold text-gray-500">
              {payment.instructions || 'Payez en espèces à la livraison.'}
            </p>
          )}
          {payment.provider === 'ussd' && (
            <div className="space-y-1">
              {payment.ussdCode && (
                <p className="text-sm font-bold text-gray-900 tracking-wide">{payment.ussdCode}</p>
              )}
              <p className="text-xs font-semibold text-gray-500">
                {payment.instructions || 'Composez ce code sur votre mobile puis suivez les instructions pour payer.'}
              </p>
            </div>
          )}
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2">
            {payment.provider === 'kkiapay' && (
              <button
                onClick={payKkiapay}
                disabled={busy || !kkiapay.ready}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-100 hover:bg-[#d55a20] disabled:opacity-50 transition-all active:scale-95"
              >
                {busy ? <Loader2 size={14} className="animate-spin spinner-always" /> : <Smartphone size={14} />}
                Payer avec Kkiapay
              </button>
            )}
            {payment.provider === 'fedapay' && (
              <button
                onClick={payFedapay}
                disabled={busy || !fedapay.ready}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-100 hover:bg-[#d55a20] disabled:opacity-50 transition-all active:scale-95"
              >
                {busy ? <Loader2 size={14} className="animate-spin spinner-always" /> : <Smartphone size={14} />}
                Payer avec FedaPay
              </button>
            )}
            {payment.provider === 'feexpay' && (
              <button
                onClick={payFeexpay}
                disabled={busy || !feexpay.ready}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-100 hover:bg-[#d55a20] disabled:opacity-50 transition-all active:scale-95"
              >
                {busy ? <Loader2 size={14} className="animate-spin spinner-always" /> : <Smartphone size={14} />}
                Payer avec FeexPay
              </button>
            )}
            {payment.provider === 'saspay' && payment.checkoutUrl && (
              <a
                href={payment.checkoutUrl}
                className="flex items-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-xs font-bold shadow-lg shadow-orange-100 hover:bg-[#d55a20] transition-all active:scale-95"
              >
                <CreditCard size={14} /> Continuer le paiement SasPay
              </a>
            )}
            {payment.provider === 'saspay' && (
              <button
                onClick={verify}
                disabled={busy}
                className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:border-brand hover:text-brand disabled:opacity-50 transition-all active:scale-95"
              >
                {busy ? <Loader2 size={14} className="animate-spin spinner-always" /> : <RefreshCw size={14} />}
                J’ai payé, vérifier
              </button>
            )}
          </div>
          <p className="text-[10px] font-semibold text-gray-400">
            La commande est marquée payée seulement après vérification par le serveur.
          </p>
        </>
      )}
    </div>
  );
}

export function StorePaymentPanel({ payments, customer, formatCurrency, notify }: Props) {
  if (!payments || payments.length === 0) return null;
  return (
    <div className="w-full flex flex-col items-center gap-3 mt-2">
      <p className="text-[9px] text-gray-600 font-semibold uppercase tracking-widest text-center">
        Paiement de votre commande
      </p>
      {payments.map((payment) => (
        <PaymentCard
          key={payment.id}
          payment={payment}
          customer={customer}
          formatCurrency={formatCurrency}
          notify={notify}
        />
      ))}
    </div>
  );
}

export default StorePaymentPanel;
