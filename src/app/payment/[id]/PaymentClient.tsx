'use client';

import { useState, useCallback, useEffect } from 'react';
import { confirmKkiapayPaymentAction } from '@/app/actions/subscription';
import { formatCurrency } from '@/utils';
import { useRouter } from '@/components/RouterPolyfill';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  ArrowLeft,
} from 'lucide-react';

interface PaymentClientProps {
  transactionId: string;
  planName: string;
  amount: number;
  environment: 'sandbox' | 'live';
  publicKey: string;
  durationLabel?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

export function PaymentClient({
  transactionId,
  planName,
  amount,
  environment,
  publicKey,
  userName,
  userEmail,
  userPhone,
}: PaymentClientProps) {
  const router = useRouter();
  const isSandbox = environment === 'sandbox';
  const amountLabel = formatCurrency(amount);

  const [status, setStatus] = useState<'idle' | 'loading' | 'paying' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [scriptLoaded, setScriptLoaded] = useState(false);

  // Load Kkiapay script once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.openKkiapayWidget) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.kkiapay.me/k.js';
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => {
      setStatus('error');
      setMessage('Impossible de charger le module de paiement.');
    };
    document.head.appendChild(script);
  }, []);

  const handlePay = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (!w.openKkiapayWidget) {
      setStatus('error');
      setMessage('Module de paiement non chargé.');
      return;
    }
    setStatus('paying');
    setMessage('');

    // Clean up old listeners to avoid duplicates
    w.addSuccessListener = w.addSuccessListener || function () {};
    w.addFailedListener = w.addFailedListener || function () {};

    w.addSuccessListener(async (res: any) => {
      const kTxId = res?.transactionId || res?.id || (typeof res === 'string' ? res : '');
      if (!kTxId) {
        setStatus('error');
        setMessage('Réponse du paiement incomplète.');
        return;
      }
      setStatus('loading');
      try {
        const confirm = await confirmKkiapayPaymentAction(transactionId, kTxId);
        if (confirm.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setMessage(confirm.error || 'Le paiement n\'a pas été confirmé.');
        }
      } catch (e) {
        setStatus('error');
        setMessage('Erreur lors de la confirmation du paiement.');
      }
    });

    w.addFailedListener((err: any) => {
      setStatus('error');
      setMessage('Le paiement a été annulé ou a échoué.');
    });

    try {
      w.openKkiapayWidget({
        amount: String(amount),
        key: publicKey,
        sandbox: isSandbox,
        position: 'center',
        theme: '#f56b2a',
        paymentmethod: ['momo'],
        countries: ['BJ'],
        partnerId: transactionId,
        data: JSON.stringify({ plan: planName, tier: planName, duration: planName }),
        name: userName || '',
        email: userEmail || '',
        phone: userPhone || '',
        callback: '',
      });
    } catch (e: any) {
      console.error('Kkiapay widget error:', e);
      setStatus('error');
      setMessage('Erreur lors de l\'ouverture du module de paiement.');
    }
  }, [amount, environment, publicKey, transactionId, userName, userEmail, userPhone, planName, isSandbox]);

  const goBack = () => {
    router.push('/subscription');
  };

  return (
    <div className="min-h-screen bg-[#f4f5f7] relative overflow-hidden flex items-center justify-center p-4 md:p-8">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] bg-[#f56b2a]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[380px] h-[380px] bg-orange-200/25 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex items-center justify-between mb-5 px-1">
          <button
            onClick={() => router.push('/subscription')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            Retour
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <Lock size={12} className="text-emerald-500" />
            Paiement sécurisé
          </span>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)] p-7">
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-slate-100">
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Abonnement</p>
              <h1 className="text-lg font-black text-slate-900 mt-0.5 truncate">{planName}</h1>
            </div>
            <p className="text-lg font-black text-slate-900 whitespace-nowrap">{amountLabel}</p>
          </div>

          {status === 'success' ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-5">
                <span className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-60" />
                <span className="relative w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 size={34} className="text-white" />
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900">Paiement réussi</h2>
              <p className="text-sm text-emerald-600 font-black mt-1">{amountLabel}</p>
              <button
                onClick={goBack}
                className="w-full bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-3 rounded-xl transition-colors mt-6 active:scale-[0.99]"
              >
                Retour à l&apos;abonnement
              </button>
            </div>
          ) : status === 'error' ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mb-5">
                <AlertCircle size={30} className="text-red-500" />
              </div>
              <h2 className="text-lg font-black text-slate-900">Erreur</h2>
              <p className="text-sm text-red-600 mt-2">{message}</p>
              <button
                onClick={() => setStatus('idle')}
                className="w-full bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-3 rounded-xl transition-colors mt-6 active:scale-[0.99]"
              >
                Réessayer
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {isSandbox && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700">
                  Mode test — utilisez un numéro Kkiapay sandbox (ex. 61000000 MTN, 68000000 Moov) et validez avec le PIN de test.
                </div>
              )}

              <div className="text-center">
                <p className="text-xs font-medium text-slate-400">Montant à payer</p>
                <p className="text-3xl font-black text-slate-900 tracking-tight">{amountLabel}</p>
              </div>

              {message && !message.includes('confirm') && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-2">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 font-medium">{message}</p>
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={status === 'paying' || !scriptLoaded}
                className="w-full bg-[#f56b2a] hover:bg-[#d55a20] disabled:opacity-60 text-white text-base font-black py-4 rounded-2xl transition-colors active:scale-[0.99] flex items-center justify-center gap-2 shadow-xl shadow-[#f56b2a]/20"
              >
                {status === 'paying' ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Ouverture du paiement…
                  </>
                ) : (
                  <>Payer {amountLabel}</>
                )}
              </button>

              {!publicKey && (
                <p className="text-[10px] text-center text-red-500 font-medium">
                  Aucune clé publique Kkiapay configurée — vérifiez .env
                </p>
              )}

              <p className="text-[10px] text-center text-slate-400">
                Paiement sécurisé par Mobile Money via Kkiapay
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
