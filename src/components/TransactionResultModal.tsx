'use client';

import React from 'react';
import { Check, X, AlertTriangle, Loader2, MessageCircle, ArrowRight, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/utils';
import { SubscriptionTier, SubscriptionDuration } from '@/types';

export type TransactionModalStatus = 'success' | 'error' | 'cancelled' | 'loading';

export interface TransactionModalData {
  status: TransactionModalStatus;
  title?: string;
  message?: string;
  amount?: number;
  currency?: string;
  tier?: SubscriptionTier;
  duration?: SubscriptionDuration;
  transactionId?: string;
  reference?: string;
  provider?: 'fedapay' | 'kkiapay';
  date?: Date | string;
}

interface TransactionResultModalProps {
  isOpen: boolean;
  data: TransactionModalData | null;
  onClose: () => void;
  onRetry?: () => void;
}

export const TransactionResultModal: React.FC<TransactionResultModalProps> = ({
  isOpen,
  data,
  onClose,
  onRetry,
}) => {
  if (!isOpen || !data) return null;

  const {
    status,
    title,
    message,
    amount,
    currency = 'FCFA',
    tier,
    duration,
  } = data;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-y-auto bg-black/65 backdrop-blur-md animate-fadeIn">
      {/* Container */}
      <div 
        className="relative w-full max-w-[400px] bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-pop"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top subtle decorative gradient bar */}
        <div className={`h-2 w-full ${
          status === 'success' ? 'bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-600' :
          status === 'error' ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600' :
          status === 'cancelled' ? 'bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600' :
          'bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-600 animate-pulse'
        }`} />

        {/* Close button */}
        {status !== 'loading' && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors z-10"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        )}

        <div className="p-6 md:p-8 flex flex-col items-center text-center">
          {/* Animated Icon Section (Binance Style) */}
          <div className="relative mb-5 flex items-center justify-center">
            {status === 'success' && (
              <>
                {/* Expanding Glowing Waves */}
                <div className="absolute w-24 h-24 rounded-full bg-emerald-500/20 animate-ping opacity-60 pointer-events-none" />
                <div className="absolute w-28 h-28 rounded-full bg-emerald-500/10 animate-pulse pointer-events-none" />
                {/* Floating Particles */}
                <div className="absolute -top-2 -left-2 w-2 h-2 rounded-full bg-emerald-400 animate-bounce delay-75" />
                <div className="absolute -top-3 right-0 w-2.5 h-2.5 rounded-full bg-amber-400 animate-bounce delay-150" />
                <div className="absolute bottom-0 -left-3 w-2 h-2 rounded-full bg-teal-400 animate-bounce delay-300" />
                <div className="absolute bottom-1 -right-2 w-2 h-2 rounded-full bg-emerald-300 animate-bounce delay-100" />
                
                {/* Central Main Badge */}
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 p-1 shadow-lg shadow-emerald-500/30 flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-emerald-500 flex items-center justify-center text-white border-2 border-white/40">
                    <Check size={38} strokeWidth={3.5} className="animate-in zoom-in duration-300" />
                  </div>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                {/* Red Pulse Waves */}
                <div className="absolute w-24 h-24 rounded-full bg-red-500/20 animate-ping opacity-50 pointer-events-none" />
                <div className="absolute w-28 h-28 rounded-full bg-red-500/10 animate-pulse pointer-events-none" />
                
                {/* Central Red Badge */}
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-red-600 to-rose-400 p-1 shadow-lg shadow-red-500/30 flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-red-500 flex items-center justify-center text-white border-2 border-white/40">
                    <X size={38} strokeWidth={3.5} className="animate-in zoom-in duration-300" />
                  </div>
                </div>
              </>
            )}

            {status === 'cancelled' && (
              <>
                {/* Amber Pulse Waves */}
                <div className="absolute w-24 h-24 rounded-full bg-amber-500/20 animate-ping opacity-50 pointer-events-none" />
                <div className="absolute w-28 h-28 rounded-full bg-amber-500/10 animate-pulse pointer-events-none" />
                
                {/* Central Amber Badge */}
                <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 to-orange-400 p-1 shadow-lg shadow-amber-500/30 flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-amber-500 flex items-center justify-center text-white border-2 border-white/40">
                    <AlertTriangle size={36} strokeWidth={2.8} className="animate-in zoom-in duration-300" />
                  </div>
                </div>
              </>
            )}

            {status === 'loading' && (
              <div className="relative w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center border-4 border-blue-200 border-t-blue-600 animate-spin">
                <Loader2 size={32} className="text-blue-600 animate-pulse" />
              </div>
            )}
          </div>

          {/* Status Title */}
          <h3 className={`text-xl md:text-2xl font-black tracking-tight mb-1.5 ${
            status === 'success' ? 'text-emerald-700' :
            status === 'error' ? 'text-red-600' :
            status === 'cancelled' ? 'text-amber-700' :
            'text-blue-700'
          }`}>
            {title || (
              status === 'success' ? 'Paiement Réussi !' :
              status === 'error' ? 'Paiement Échoué' :
              status === 'cancelled' ? 'Paiement Annulé' :
              'Vérification en cours...'
            )}
          </h3>

          {/* Subtitle / Explanation */}
          <p className="text-xs md:text-sm font-medium text-slate-500 mb-6 max-w-xs leading-relaxed">
            {message || (
              status === 'success' ? 'Votre abonnement a été activé avec succès. Toutes vos fonctionnalités sont prêtes.' :
              status === 'error' ? 'La transaction n\'a pas pu être validée par l\'opérateur.' :
              status === 'cancelled' ? 'Vous avez annulé la session de paiement. Aucun montant n\'a été débité.' :
              'Confirmation de votre transaction en cours auprès de la passerelle de paiement...'
            )}
          </p>

          {/* Prominent Amount Box */}
          {typeof amount === 'number' && amount > 0 && (
            <div className="w-full bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 flex flex-col items-center justify-center">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Montant Total</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  {formatCurrency(amount).replace(/\s*FCFA/i, '').trim()}
                </span>
                <span className="text-xs font-black text-slate-500">{currency}</span>
              </div>
              {tier && (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-100/70 border border-orange-200/60 text-orange-700 text-[11px] font-extrabold">
                  <span>Formule {tier}</span>
                  <span className="text-orange-400">•</span>
                  <span>{duration === 'annual' ? 'Annuel' : duration === 'quarterly' ? 'Trimestriel' : 'Mensuel'}</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-2.5">
            {status === 'success' && (
              <button
                onClick={onClose}
                className="w-full py-3.5 px-6 rounded-2xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Accéder à mon espace</span>
                <ArrowRight size={16} />
              </button>
            )}

            {(status === 'error' || status === 'cancelled') && (
              <>
                {onRetry && (
                  <button
                    onClick={onRetry}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#f56b2a] hover:bg-[#e05a1d] text-white font-extrabold text-sm shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <RefreshCw size={16} />
                    <span>Réessayer le paiement</span>
                  </button>
                )}
                <div className="flex items-center gap-2 w-full">
                  <a
                    href="https://wa.me/?text=Bonjour%20PosMarket%2C%20j%27ai%20besoin%20d%27assistance%20pour%20mon%20paiement%20d%27abonnement."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <MessageCircle size={14} className="text-emerald-600" />
                    <span>Aide WhatsApp</span>
                  </a>
                  <button
                    onClick={onClose}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
