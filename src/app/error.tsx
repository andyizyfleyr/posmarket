'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  RotateCcw, 
  Home, 
  ShoppingBag, 
  AlertTriangle, 
  MessageCircle, 
  ChevronRight, 
  HelpCircle,
  Sparkles,
  ArrowLeft
} from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: ErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
    // Log error in monitoring if in production
    console.error('Unhandled Application Error:', error);
  }, [error]);

  const handleRetry = () => {
    setIsRetrying(true);
    try {
      reset();
    } catch {
      window.location.reload();
    }
    setTimeout(() => setIsRetrying(false), 1500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffaf7] via-white to-[#f8fafc] flex flex-col justify-between selection:bg-[#f56b2a]/20 selection:text-[#f56b2a]">
      {/* Top Brand Bar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f56b2a] to-[#ff8c42] flex items-center justify-center text-white shadow-lg shadow-[#f56b2a]/25 group-hover:scale-105 transition-transform duration-300">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-gray-950 flex items-center gap-1">
              Pos<span className="text-[#f56b2a]">Market</span>
            </span>
            <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest -mt-1">
              Express Marketplace
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 bg-white/80 hover:bg-white border border-gray-200/80 rounded-full shadow-sm backdrop-blur-sm transition-all"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Accueil</span>
        </Link>
      </header>

      {/* Main Error Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-lg mx-auto">
          {/* Main Card */}
          <div className="relative bg-white rounded-3xl border border-orange-100/80 shadow-[0_20px_50px_rgba(245,107,42,0.08)] p-6 sm:p-10 text-center overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-orange-200/30 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-amber-200/30 rounded-full blur-3xl pointer-events-none" />

            {/* Glowing Icon Badge */}
            <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#f56b2a]/20 to-[#fb923c]/40 rounded-full animate-ping opacity-60" style={{ animationDuration: '3s' }} />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-orange-50 to-orange-100/80 border-2 border-orange-200/60 flex items-center justify-center shadow-inner">
                <AlertTriangle className="w-9 h-9 text-[#f56b2a] animate-bounce" style={{ animationDuration: '2.5s' }} />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-white border border-orange-200 shadow-sm flex items-center justify-center">
                <Sparkles className="w-3.5 h-3.5 text-[#f56b2a]" />
              </div>
            </div>

            {/* Heading */}
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-2">
              Une petite interruption technique
            </h1>

            {/* Subtext */}
            <p className="text-sm sm:text-base text-gray-600 font-normal leading-relaxed max-w-md mx-auto mb-8">
              La page n&apos;a pas pu se charger correctement. Vos données et votre panier sont conservés en toute sécurité.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-[#f56b2a] to-[#ff7d3b] hover:from-[#e45a19] hover:to-[#f56b2a] text-white text-sm font-bold rounded-2xl shadow-lg shadow-[#f56b2a]/30 hover:shadow-xl hover:shadow-[#f56b2a]/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-70 cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Rechargement...' : 'Recharger la page'}</span>
              </button>

              <Link
                href="/"
                className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-800 text-sm font-bold rounded-2xl border border-gray-200/80 hover:border-gray-300 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <Home className="w-4 h-4 text-gray-500" />
                <span>Retour à l&apos;accueil</span>
              </Link>
            </div>

            {/* Secondary Help Actions */}
            <div className="pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <button
                type="button"
                onClick={() => {
                  if (window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="inline-flex items-center gap-1 font-semibold text-gray-500 hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Page précédente</span>
              </button>

              <a
                href="https://wa.me/221781234567?text=Bonjour,%20j'ai%20rencontré%20un%20souci%20sur%20PosMarket"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 font-semibold text-[#f56b2a] hover:text-[#d55a20] transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Assistance WhatsApp</span>
              </a>
            </div>

            {/* Error Details for Debugging (Collapsible) */}
            {error?.digest && (
              <div className="mt-6 pt-4 border-t border-dashed border-gray-100 text-left">
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>Détails techniques (Code: {error.digest})</span>
                  <ChevronRight className={`w-3 h-3 transition-transform ${showTechnicalDetails ? 'rotate-90' : ''}`} />
                </button>
                {showTechnicalDetails && (
                  <div className="mt-2 p-3 bg-gray-900 text-gray-100 rounded-xl text-[10px] font-mono overflow-x-auto">
                    <p className="text-orange-400 font-semibold mb-1">Erreur Référence : {error.digest}</p>
                    <p className="text-gray-300">{error.message || 'Erreur non spécifiée'}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 py-6 text-center text-xs font-medium text-gray-400">
        © {new Date().getFullYear()} PosMarket. Tous droits réservés.
      </footer>
    </div>
  );
}
