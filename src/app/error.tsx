'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  RotateCcw, 
  Home, 
  ShoppingBag, 
  AlertCircle, 
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  MessageSquare
} from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: ErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  useEffect(() => {
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

  const copyIncidentCode = async () => {
    if (!error?.digest) return;
    try {
      await navigator.clipboard.writeText(error.digest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard write failures
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-brand/15 selection:text-brand">
      {/* Top Navigation */}
      <header className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center text-white shadow-xs group-hover:opacity-90 transition-opacity">
            <ShoppingBag className="w-4.5 h-4.5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg tracking-tight text-slate-900 leading-none">
              Pos<span className="text-brand">Market</span>
            </span>
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider mt-0.5">
              Express Marketplace
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200/90 rounded-lg shadow-xs hover:border-slate-300 transition-colors"
        >
          <Home className="w-3.5 h-3.5 text-slate-500" />
          <span>Accueil</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] p-7 sm:p-9 text-center">
            
            {/* Status Icon */}
            <div className="w-14 h-14 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-brand mx-auto mb-5 shadow-xs">
              <AlertCircle className="w-7 h-7 stroke-[1.75]" />
            </div>

            {/* Title & Description */}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Page temporairement indisponible
            </h1>

            <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto mb-4">
              Un problème est survenu lors du chargement de cette page. Veuillez réessayer ou retourner à l&apos;accueil.
            </p>

            {/* Reassurance Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/60 text-slate-600 text-xs font-medium mb-6">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Vos commandes et votre panier restent sauvegardés</span>
            </div>

            {/* Main Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 mb-6">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-semibold rounded-xl shadow-xs transition-colors disabled:opacity-60 cursor-pointer"
              >
                <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Rechargement...' : 'Réessayer'}</span>
              </button>

              <Link
                href="/"
                className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-semibold rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
              >
                <Home className="w-4 h-4 text-slate-400" />
                <span>Accueil</span>
              </Link>
            </div>

            {/* Navigation & Help Links */}
            <div className="pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.history.length > 1) {
                    window.history.back();
                  } else {
                    window.location.href = '/';
                  }
                }}
                className="inline-flex items-center gap-1 hover:text-slate-900 font-medium transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Page précédente</span>
              </button>

              <a
                href="https://wa.me/?text=Bonjour%2C%20j%27ai%20rencontr%C3%A9%20une%20erreur%20sur%20PosMarket"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-600 hover:text-brand font-medium transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Assistance</span>
              </a>
            </div>

            {/* Incident Code & Debug details */}
            {error?.digest && (
              <div className="mt-5 pt-4 border-t border-slate-100 text-left">
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200/70 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-1.5 text-slate-500 truncate">
                    <span className="text-[11px] font-medium text-slate-400">Incident :</span>
                    <code className="font-mono text-[11px] text-slate-700 select-all font-semibold">{error.digest}</code>
                  </div>
                  <button
                    type="button"
                    onClick={copyIncidentCode}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors ml-2 shrink-0 cursor-pointer"
                    title="Copier le code incident"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span className="text-emerald-600 font-semibold">Copié</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Collapsible stack details in dev or when toggled */}
                <button
                  type="button"
                  onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                  className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <span>Détails techniques</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showTechnicalDetails ? 'rotate-180' : ''}`} />
                </button>

                {showTechnicalDetails && (
                  <div className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto leading-relaxed">
                    <p className="text-orange-400 font-semibold mb-1">Réf: {error.digest}</p>
                    <p className="text-slate-300 break-words">{error.message || 'Erreur non spécifiée'}</p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto px-4 py-6 text-center text-xs text-slate-400 font-medium">
        © {new Date().getFullYear()} PosMarket. Tous droits réservés.
      </footer>
    </div>
  );
}
