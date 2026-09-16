'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ShieldCheck, Lock, ArrowLeft } from 'lucide-react';
import { formatCurrency } from '@/utils';
import { useRouter } from '@/components/RouterPolyfill';

const CHECKOUT_JS_URL = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';

interface PaymentClientProps {
    publicKey: string;
    environment: 'sandbox' | 'live';
    transactionId: string;
    planName: string;
    durationLabel: string;
    amount: number;
    userEmail: string;
}

type CheckoutState = 'loading' | 'ready' | 'completed' | 'cancelled' | 'error';

export const PaymentClient: React.FC<PaymentClientProps> = ({
    publicKey,
    environment,
    transactionId,
    planName,
    durationLabel,
    amount,
    userEmail,
}) => {
    const router = useRouter();
    const [state, setState] = useState<CheckoutState>('loading');
    const initedRef = useRef(false);

    const initCheckout = useCallback(() => {
        interface FedaPayWidget {
            CHECKOUT_COMPLETED: string;
            DIALOG_DISMISSED: string;
            init: (config: Record<string, unknown>) => void;
        }
        const FedaPay = (window as unknown as { FedaPay?: FedaPayWidget }).FedaPay;
        if (!FedaPay) return;

        if (initedRef.current) return;
        initedRef.current = true;

        try {
            FedaPay.init({
                environment,
                public_key: publicKey,
                transaction: { id: transactionId },
                currency: { iso: 'XOF' },
                customer: { email: userEmail },
                button: { text: 'Payer maintenant' },
                container: '#fedapay-checkout',
                onComplete: (resp: { reason?: string }) => {
                    const reason = String(resp?.reason || '').toUpperCase();
                    if (reason.includes('COMPLETE')) {
                        setState('completed');
                        router.replace('/subscription?fedapay=return');
                    } else {
                        setState('ready');
                    }
                },
            });
            setState('ready');
        } catch (error) {
            console.error('[Checkout.js] init failed:', error);
            setState('error');
        }
    }, [environment, publicKey, router, transactionId, userEmail]);

    const retryCheckout = useCallback(() => {
        initedRef.current = false;
        setState('loading');
        window.setTimeout(() => initCheckout(), 0);
    }, [initCheckout]);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        let disposed = false;

        const existing = document.querySelector<HTMLScriptElement>('script[data-fedapay-checkout]');
        if (existing) {
            if (existing.dataset.loaded === '1') {
                initCheckout();
            } else {
                const onLoad = () => {
                    if (disposed) return;
                    existing.dataset.loaded = '1';
                    initCheckout();
                };
                existing.addEventListener('load', onLoad);
                return () => {
                    disposed = true;
                    existing.removeEventListener('load', onLoad);
                };
            }
            return;
        }

        const script = document.createElement('script');
        script.src = CHECKOUT_JS_URL;
        script.async = true;
        script.dataset.fedapayCheckout = '1';
        script.addEventListener('load', () => {
            if (disposed) return;
            script.dataset.loaded = '1';
            initCheckout();
        });
        script.addEventListener('error', () => {
            if (disposed) return;
            setState('error');
        });
        document.head.appendChild(script);

        return () => {
            disposed = true;
        };
    }, [initCheckout]);

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center p-4 md:p-8">
            <div className="w-full max-w-lg">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#f56b2a] text-white flex items-center justify-center font-black text-lg shadow-md">
                            P
                        </div>
                        <span className="text-lg font-black text-slate-900">
                            PosMarket
                        </span>
                    </div>
                    <a
                        href="/subscription"
                        className="flex items-center gap-1.5 text-xs md:text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        <ArrowLeft size={14} />
                        Annuler
                    </a>
                </div>

                <div className="bg-white rounded-2xl md:rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-gradient-to-br from-[#f56b2a] to-[#d55a20] px-6 py-5 md:px-8 md:py-6">
                        <p className="text-[10px] md:text-xs font-bold text-white/80 uppercase tracking-widest">Récapitulatif</p>
                        <div className="flex items-end justify-between mt-1.5">
                            <div>
                                <h1 className="text-xl md:text-2xl font-black text-white">Abonnement {planName}</h1>
                                <p className="text-xs md:text-sm font-semibold text-white/85 mt-0.5">{durationLabel}</p>
                            </div>
                            <p className="text-2xl md:text-3xl font-black text-white">{formatCurrency(amount)}</p>
                        </div>
                    </div>

                    <div className="p-6 md:p-8">
                        <div className="relative">
                            <div
                                id="fedapay-checkout"
                                className={`w-full min-h-[380px] ${state === 'ready' ? 'visible' : 'invisible h-[380px]'}`}
                            />

                            {state === 'loading' && (
                                <div className="absolute inset-0 bg-white rounded-xl flex flex-col items-center justify-center text-center">
                                    <span className="w-9 h-9 border-[3px] border-[#f56b2a]/25 border-t-[#f56b2a] rounded-full animate-spin mb-4" />
                                    <p className="text-sm font-bold text-slate-600">Préparation du paiement sécurisé...</p>
                                </div>
                            )}

                            {state === 'completed' && (
                                <div className="absolute inset-0 bg-white rounded-xl flex flex-col items-center justify-center text-center">
                                    <span className="w-9 h-9 border-[3px] border-green-500/25 border-t-green-500 rounded-full animate-spin mb-4" />
                                    <p className="text-sm font-bold text-slate-600">Paiement confirmé ! Activation de votre abonnement...</p>
                                </div>
                            )}

                            {state === 'cancelled' && (
                                <div className="absolute inset-0 bg-white rounded-xl flex flex-col items-center justify-center text-center">
                                    <p className="text-sm font-bold text-slate-600 mb-5">Paiement annulé. Aucun débit n&apos;a été effectué.</p>
                                    <a
                                        href="/subscription"
                                        className="bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-2.5 px-5 rounded-xl transition-colors"
                                    >
                                        Retour à l&apos;abonnement
                                    </a>
                                </div>
                            )}

                            {state === 'error' && (
                                <div className="absolute inset-0 bg-white rounded-xl flex flex-col items-center justify-center text-center">
                                    <p className="text-sm font-bold text-slate-600 mb-5">
                                        Le chargement du module de paiement a échoué.
                                    </p>
                                    <button
                                        onClick={retryCheckout}
                                        className="bg-[#f56b2a] hover:bg-[#d55a20] text-white text-sm font-black py-2.5 px-5 rounded-xl transition-colors"
                                    >
                                        Réessayer
                                    </button>
                                </div>
                            )}
                        </div>

                        {state === 'ready' && (
                            <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
                                <ShieldCheck size={15} className="text-green-500" />
                                <span className="text-[11px] md:text-xs font-semibold">
                                    Paiement 100% sécurisé par FedaPay
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <p className="flex items-center justify-center gap-1.5 text-slate-400 text-[11px] md:text-xs font-medium mt-5">
                    <Lock size={12} />
                    Transaction {transactionId} — vos informations bancaires ne quittent pas FedaPay.
                </p>
            </div>
        </div>
    );
};