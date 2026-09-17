'use client';

import { useState } from 'react';
import { paySubscriptionStepAction } from '@/app/actions/subscription';
import { SOFT_PAY_OPERATORS, SoftPayOperator } from '@/lib/paydunya';
import { formatCurrency } from '@/utils';
import { useRouter } from '@/components/RouterPolyfill';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Smartphone,
  Lock,
  ArrowLeft,
} from 'lucide-react';

interface PaymentClientProps {
  transactionId: string;
  planName: string;
  amount: number;
  environment: 'sandbox' | 'live';
  durationLabel?: string;
  userName?: string;
  userEmail?: string;
  userPhone?: string;
}

type StepResult = { success: boolean; pending?: boolean; message?: string; error?: string };

export function PaymentClient({
  transactionId,
  planName,
  amount,
  environment,
  userEmail,
  userPhone,
}: PaymentClientProps) {
  const router = useRouter();
  const isSandbox = environment === 'sandbox';

  const checkoutUrl = isSandbox
    ? `https://app.paydunya.com/sandbox-checkout/invoice/${transactionId}`
    : `https://app.paydunya.com/checkout/invoice/${transactionId}`;

  const [operator, setOperator] = useState<SoftPayOperator>('mtn-benin');
  const [phone, setPhone] = useState(userPhone || '');
  const [email, setEmail] = useState(isSandbox ? '' : userEmail || '');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StepResult | null>(null);

  const handlePay = async () => {
    if (!phone.trim()) {
      setResult({ success: false, error: 'Numéro requis.' });
      return;
    }
    if (isSandbox && !email.trim()) {
      setResult({ success: false, error: 'Email requis.' });
      return;
    }
    if (isSandbox && !password.trim()) {
      setResult({ success: false, error: 'Mot de passe requis.' });
      return;
    }

    setLoading(true);
    setResult(null);
    try {
      const res = await paySubscriptionStepAction(
        transactionId,
        isSandbox ? 'mtn-benin' : operator,
        { phone, email, password: isSandbox ? password : undefined },
      );
      if (!res.success) {
        setResult({ success: false, error: res.error });
      } else {
        setResult({ success: true, pending: res.pending, message: res.message });
      }
    } catch {
      setResult({ success: false, error: 'Une erreur est survenue.' });
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    router.push('/subscription');
    router.refresh();
  };

  const amountLabel = formatCurrency(amount);

  const inputClass =
    'w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/40 focus:border-[#f56b2a] transition-all bg-white';

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

          {result?.success ? (
            <div className="flex flex-col items-center text-center py-6">
              <div className="relative mb-5">
                <span className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-60" />
                <span className="relative w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle2 size={34} className="text-white" />
                </span>
              </div>
              <h2 className="text-lg font-black text-slate-900">
                {result.pending ? 'Paiement en cours' : 'Paiement réussi'}
              </h2>
              <p className="text-sm text-emerald-600 font-black mt-1">{amountLabel}</p>
              <button
                onClick={goBack}
                className="w-full bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-3 rounded-xl transition-colors mt-6 active:scale-[0.99]"
              >
                Retour à l&apos;abonnement
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              {!isSandbox && (
                <div className="space-y-2">
                  {SOFT_PAY_OPERATORS.map(op => {
                    const active = operator === op.key;
                    return (
                      <button
                        key={op.key}
                        onClick={() => setOperator(op.key)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          active
                            ? 'border-[#f56b2a] bg-orange-50/60 ring-2 ring-[#f56b2a]/15'
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            active ? 'border-[#f56b2a]' : 'border-slate-300'
                          }`}
                        >
                          {active && <span className="w-2 h-2 rounded-full bg-[#f56b2a]" />}
                        </span>
                        <Smartphone size={17} className={active ? 'text-[#f56b2a]' : 'text-slate-400'} />
                        <span className="text-sm font-black text-slate-700">{op.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {isSandbox && (
                <a
                  href={checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  API Sandbox indisponible — régler via le guichet PayDunya →
                </a>
              )}

              <div>
                <label className="block text-xs font-black text-slate-600 mb-2">
                  {isSandbox ? 'Numéro de test' : 'Numéro mobile money'}
                </label>
                <div className="relative">
                  <Smartphone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+229 96 00 00 00"
                    className={`${inputClass} pl-10`}
                  />
                </div>
              </div>

              {isSandbox && (
                <>
                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-2">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="test@paydunya.com"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-600 mb-2">Mot de passe</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              {result && !result.success && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 flex items-start gap-2">
                  <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 font-medium">{result.error}</p>
                </div>
              )}

              <button
                onClick={handlePay}
                disabled={loading}
                className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-black py-3.5 rounded-xl transition-colors active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Traitement…
                  </>
                ) : (
                  <>Payer {amountLabel}</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}