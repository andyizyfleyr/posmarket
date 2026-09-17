'use client';

import { useState } from 'react';
import { paySubscriptionStepAction } from '@/app/actions/subscription';
import { SOFT_PAY_OPERATORS, SoftPayOperator } from '@/lib/paydunya';
import { formatCurrency } from '@/utils';
import { useRouter } from '@/components/RouterPolyfill';
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck, Smartphone } from 'lucide-react';

interface PaymentClientProps {
  transactionId: string;
  planName: string;
  amount: number;
  environment: 'sandbox' | 'live';
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#f56b2a] px-5 md:px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-white/80 text-[10px] md:text-xs font-bold uppercase tracking-wider">Paiement sécurisé</p>
              <h1 className="text-white text-base md:text-lg font-black">Abonnement {planName}</h1>
            </div>
            <ShieldCheck size={28} className="text-white/90" />
          </div>

          <div className="p-5 md:p-6 space-y-5">
            <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-3">
              <span className="text-xs md:text-sm text-slate-600 font-medium">Montant à payer</span>
              <span className="text-lg md:text-xl font-black text-slate-900">{formatCurrency(amount)}</span>
            </div>

            {result?.success ? (
              <div className={`rounded-xl border p-4 text-center ${result.pending ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                {result.pending ? (
                  <>
                    <CheckCircle2 size={28} className="mx-auto mb-2 text-amber-600" />
                    <p className="text-sm font-black text-slate-900 mb-1">Paiement en cours</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={28} className="mx-auto mb-2 text-green-600" />
                    <p className="text-sm font-black text-slate-900 mb-1">Paiement réussi</p>
                  </>
                )}
                <p className="text-xs text-slate-500 mb-4">{result.message || 'Votre paiement a bien été pris en compte.'}</p>
                <button
                  onClick={goBack}
                  className="w-full bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-2.5 rounded-xl transition-colors"
                >
                  Retour à l&apos;abonnement
                </button>
              </div>
            ) : (
              <>
                {/* Operator selection (live only) */}
                {!isSandbox && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 mb-2">Choisissez votre moyen de paiement</p>
                    <div className="grid grid-cols-1 gap-2">
                      {SOFT_PAY_OPERATORS.map(op => (
                        <button
                          key={op.key}
                          onClick={() => setOperator(op.key)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                            operator === op.key
                              ? 'border-[#f56b2a] bg-orange-50 ring-1 ring-[#f56b2a]'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <Smartphone size={18} className={operator === op.key ? 'text-[#f56b2a]' : 'text-slate-400'} />
                          <div className="text-left">
                            <p className="text-sm font-black text-slate-900">{op.label}</p>
                            <p className="text-[10px] text-slate-400 font-medium">{op.hint}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sandbox notice + direct checkout link */}
                {isSandbox && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-900">Mode Test Sandbox</p>
                        <p className="text-[11px] text-amber-700 mt-0.5">
                          L&apos;API SoftPay Sandbox de PayDunya renvoie actuellement une erreur 404 sur leurs serveurs. Pour valider votre paiement de test, cliquez ci-dessous pour ouvrir le guichet Sandbox officiel.
                        </p>
                      </div>
                    </div>
                    <a
                      href={checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full text-center bg-[#f56b2a] hover:bg-[#d55a20] text-white text-xs font-black py-2.5 rounded-xl transition-colors"
                    >
                      Payer sur le guichet Sandbox PayDunya &rarr;
                    </a>
                  </div>
                )}

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">
                    {isSandbox ? 'Numero du compte de test' : 'Numero mobile money'}
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+229 96 00 00 00"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]"
                  />
                </div>

                {/* Sandbox email + password */}
                {isSandbox && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Email du compte de test</label>
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="test@paydunya.com"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5">Mot de passe du compte de test</label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#f56b2a]"
                      />
                    </div>
                  </>
                )}

                {result && !result.success && (
                  <div className="space-y-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-red-600 font-medium">{result.error}</p>
                    </div>
                    {isSandbox && (
                      <a
                        href={checkoutUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full text-center bg-[#f56b2a] hover:bg-[#d55a20] text-white text-xs font-black py-2.5 rounded-xl transition-colors"
                      >
                        Ouvrir le guichet Sandbox PayDunya &rarr;
                      </a>
                    )}
                  </div>
                )}

                <button
                  onClick={handlePay}
                  disabled={loading}
                  className="w-full bg-[#f56b2a] hover:bg-[#d55a20] disabled:opacity-60 text-white text-sm font-black py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    'Payer maintenant'
                  )}
                </button>

                <p className="text-[10px] text-slate-400 text-center">
                  Paiement via votre operateur mobile money. Aucune carte requise.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}