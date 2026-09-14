'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ShoppingBag, 
  RotateCcw, 
  Home, 
  ArrowLeft, 
  Store, 
  PackageX, 
  Sparkles,
  Search
} from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-b from-[#fffaf7] via-white to-[#f8fafc] flex flex-col justify-between selection:bg-[#f56b2a]/20 selection:text-[#f56b2a]">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f56b2a] to-[#ff8c42] flex items-center justify-center text-white shadow-lg shadow-[#f56b2a]/25 group-hover:scale-105 transition-transform duration-300">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-xl tracking-tight text-gray-950 flex items-center gap-1">
              Pos<span className="text-[#f56b2a]">Market</span>
            </span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest -mt-1">
              Express Marketplace
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-gray-600 hover:text-gray-900 bg-white border border-gray-200/80 rounded-full shadow-sm transition-all"
        >
          <Home className="w-3.5 h-3.5" />
          <span>Accueil</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-md mx-auto text-center">
          <div className="relative bg-white rounded-3xl border border-orange-100/90 shadow-[0_20px_50px_rgba(245,107,42,0.08)] p-6 sm:p-8 overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-orange-100/50 rounded-full blur-3xl pointer-events-none" />

            {/* Icon */}
            <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-gradient-to-tr from-orange-50 to-orange-100 border border-orange-200 flex items-center justify-center text-[#f56b2a] shadow-inner">
              <PackageX className="w-9 h-9" />
            </div>

            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight mb-2">
              Impossible d&apos;afficher cet article
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 font-medium leading-relaxed max-w-sm mx-auto mb-6">
              Une anomalie passagère est survenue lors du chargement des détails du produit. Vous pouvez recharger la fiche ou explorer les autres boutiques.
            </p>

            {/* Actions */}
            <div className="flex flex-col gap-2.5 mb-6">
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[#f56b2a] to-[#ff7d3b] hover:from-[#e45a19] hover:to-[#f56b2a] text-white text-xs sm:text-sm font-black rounded-2xl shadow-md shadow-[#f56b2a]/25 hover:shadow-lg transition-all cursor-pointer disabled:opacity-70"
              >
                <RotateCcw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                <span>{isRetrying ? 'Rechargement...' : 'Réessayer'}</span>
              </button>

              <Link
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs sm:text-sm font-bold rounded-2xl border border-gray-200/80 transition-all cursor-pointer"
              >
                <Search className="w-4 h-4 text-gray-400" />
                <span>Explorer le marketplace</span>
              </Link>
            </div>

            <div className="pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <button
                type="button"
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1 font-bold hover:text-gray-900 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour</span>
              </button>

              {error?.digest && (
                <span className="text-[10px] font-mono text-gray-300">
                  Réf: {error.digest.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-7xl mx-auto px-4 py-6 text-center text-xs font-semibold text-gray-400">
        © {new Date().getFullYear()} PosMarket
      </footer>
    </div>
  );
}
