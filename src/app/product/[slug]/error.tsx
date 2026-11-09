'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, RotateCcw, Home, ArrowLeft, PackageX, Search } from 'lucide-react';

interface ProductErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ProductErrorPage({ error, reset }: ProductErrorProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    console.error('Product Page Error:', error);
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between selection:bg-brand/15 selection:text-brand">
      {/* Header */}
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
            
            {/* Icon */}
            <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-brand shadow-xs">
              <PackageX className="w-7 h-7 stroke-[1.75]" />
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
              Impossible d&apos;afficher cet article
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
              Une anomalie passagère est survenue lors du chargement de la fiche produit. Vous pouvez réactualiser ou découvrir d&apos;autres articles.
            </p>

            {/* Actions */}
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
                <Search className="w-4 h-4 text-slate-400" />
                <span>Explorer</span>
              </Link>
            </div>

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

              {error?.digest && (
                <span className="text-[11px] font-mono text-slate-400">
                  Réf: {error.digest.slice(0, 10)}
                </span>
              )}
            </div>
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
