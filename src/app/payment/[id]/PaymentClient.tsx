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
  ShieldCheck,
  Smartphone,
  Lock,
  Store,
  Receipt,
  ArrowLeft,
  BadgeCheck,
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
  durationLabel,
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
      setResult({ success: false, error: 'Saisissez votre numéro de téléphone.' });
      return;
    }
    if (isSandbox && !email.trim()) {
      setResult({ success: false, error: 'Saisissez l\'email du compte de test PayDunya.' });
      return;
    }
    if (isSandbox && !password.trim()) {
      setResult({ success: false, error: 'Saisissez le mot de passe du compte de test PayDunya.' });
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

  return (
    <div className="min-h-screen bg-[#f4f5f7] relative overflow-hidden flex items-center justify-center p-4 md:p-8">
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -right-24 w-[420px] h-[420px] bg-[#f56b2a]/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[380px] h-[380px] bg-orange-200/25 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-4xl">
        <div className="flex items-center justify-between mb-6 px-1">
          <button
            onClick={() => router.push('/subscription')}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            Retour à l&apos;abonnement
          </button>
          <div className="flex items-center gap-2 rounded-full bg-white border border-slate-200 shadow-sm px-3.5 py-1.5">
            <Lock size={12} className="text-emerald-600" />
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
              {isSandbox ? 'Paiement sécurisé · test' : 'Paiement sécurisé'}
            </span>
          </div>
        </div>

        <div className="grid md:grid-cols-[0.95fr_1.05fr] gap-5 items-start">
          <aside className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)] p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Store size={16} className="text-[#f56b2a]" />
                <span className="text-sm font-black tracking-tight text-slate-900">PosMarket</span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Récapitulatif</span>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                  <Receipt size={18} className="text-[#f56b2a]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">Abonnement {planName}</p>
                  <p className="text-[11px] text-slate-400 font-medium">Boutique PosMarket</p>
                </div>
                <span className="ml-auto shrink-0 bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-[10px] font-bold text-slate-500">
                  ×1
                </span>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Fréquence</span>
                <span className="text-slate-700 font-bold">{durationLabel || 'Unique'}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Moyen de paiement</span>
                <span className="inline-flex items-center gap-1.5 text-slate-700 font-bold">
                  <Smartphone size={13} className="text-slate-400" />
                  {isSandbox ? 'Compte de test' : 'Mobile Money (Bénin)'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400 font-medium">Environnement</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                    isSandbox ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                  }`}
                >
                  {isSandbox ? 'Mode test' : 'Mode réel'}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-200 mt-5 pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">À payer aujourd&apos;hui</p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">{amountLabel}</p>
            </div>

            <p className="mt-5 text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              Transaction unique et sécurisée. Aucune carte requise.
            </p>
          </aside>

          <section className="bg-white rounded-3xl border border-slate-200/70 shadow-[0_24px_60px_-42px_rgba(15,23,42,0.4)] p-6">
            {result?.success ? (
              <div className="flex flex-col items-center text-center py-8">
                <div className="relative mb-5">
                  <span className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-60" />
                  <span className="relative w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle2 size={34} className="text-white" />
                  </span>
                </div>
                <h2 className="text-lg font-black text-slate-900 mb-1">
                  {result.pending ? 'Paiement en cours' : 'Paiement réussi'}
                </h2>
                <p className="text-xs text-slate-500 mb-6 max-w-xs">
                  {result.pending
                    ? 'Confirmez l&apos;opération sur votre téléphone. Votre abonnement sera activé dès réception.'
                    : 'Votre abonnement est actif. Bienvenue parmi les commerçants PosMarket.'}
                </p>
                <div className="w-full rounded-2xl bg-slate-50 border border-slate-100 px-4 py-3 flex items-center justify-between mb-6">
                  <span className="text-xs text-slate-500 font-medium">Montant réglé</span>
                  <span className="text-sm font-black text-slate-900">{amountLabel}</span>
                </div>
                <button
                  onClick={goBack}
                  className="w-full bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-3 rounded-2xl transition-colors active:scale-[0.99]"
                >
                  Retour à l&apos;abonnement
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-black text-slate-900 tracking-tight">Finaliser le paiement</h2>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    {isSandbox
                      ? 'Renseignez les identifiants du compte de test PayDunya.'
                      : 'Sélectionnez votre opérateur puis validez sur votre téléphone.'}
                  </p>
                </div>

                {!isSandbox && (
                  <div>
                    <label className="block text-[11px] font-black text-slate-600 mb-2 uppercase tracking-wider">
                      Opérateur
                    </label>
                    <div className="space-y-2">
                      {SOFT_PAY_OPERATORS.map(op => {
                        const active = operator === op.key;
                        return (
                          <button
                            key={op.key}
                            onClick={() => setOperator(op.key)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all ${
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
                            <Smartphone size={18} className={active ? 'text-[#f56b2a]' : 'text-slate-400'} />
                            <span className="text-left">
                              <span className={`block text-sm font-black ${active ? 'text-slate-900' : 'text-slate-700'}`}>
                                {op.label}
                              </span>
                              <span className="block text-[10px] text-slate-400 font-medium">{op.hint}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isSandbox && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-2.5">
                    <BadgeCheck size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-black text-amber-900">Mode Test Sandbox</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">
                        L&apos;API SoftPay Sandbox est indisponible côté PayDunya. Réglez la facture de test depuis le
                        guichet officiel ci-dessous.
                      </p>
                      <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 mt-3 text-[11px] font-black text-amber-800 hover:text-amber-900 underline underline-offset-2"
                      >
                        Ouvrir le guichet Sandbox PayDunya →
                      </a>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-black text-slate-600 mb-2 uppercase tracking-wider">
                    {isSandbox ? 'Numéro du compte de test' : 'Numéro mobile money'}
                  </label>
                  <div className="relative">
                    <Smartphone
                      size={15}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      placeholder="+229 96 00 00 00"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/40 focus:border-[#f56b2a] transition-all bg-white"
                    />
                  </div>
                </div>

                {isSandbox && (
                  <>
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 mb-2 uppercase tracking-wider">
                        Email du compte de test
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="test@paydunya.com"
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/40 focus:border-[#f56b2a] transition-all bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black text-slate-600 mb-2 uppercase tracking-wider">
                        Mot de passe du compte de test
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]/40 focus:border-[#f56b2a] transition-all bg-white"
                      />
                    </div>
                  </>
                )}

                {result && !result.success && (
                  <div className="space-y-3 rounded-2xl bg-red-50 border border-red-100 px-4 py-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 font-medium">{result.error}</p>
                    </div>
                    {isSandbox && (
                      <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-black py-2.5 rounded-xl transition-colors"
                      >
                        Ouvrir le guichet Sandbox PayDunya →
                      </a>
                    )}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={loading}
                  className="w-full bg-slate-900 hover:bg-slate-700 disabled:opacity-60 text-white text-sm font-black py-3.5 rounded-2xl transition-colors active:scale-[0.99] flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
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

                <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
                  <Lock size={11} className="text-emerald-500" />
                  Connexion chiffrée · Sécurisé par PosMarket
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}