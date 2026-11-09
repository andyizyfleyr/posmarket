'use client';

import React from 'react';
import { AlertCircle, RotateCcw, Home } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalRootError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans flex items-center justify-center p-4 selection:bg-[#f56b2a]/15 selection:text-[#f56b2a]">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-[0_4px_24px_-4px_rgba(0,0,0,0.06)] p-7 sm:p-9 text-center">
          
          {/* Status Icon */}
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#f56b2a]">
            <AlertCircle className="w-7 h-7 stroke-[1.75]" aria-hidden="true" />
          </div>

          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Interruption temporaire
          </h1>

          <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto mb-6">
            Une erreur inattendue est survenue au démarrage de l&apos;application. Cliquez ci-dessous pour recharger.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <button
              type="button"
              onClick={() => (reset ? reset() : window.location.reload())}
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#f56b2a] hover:bg-[#e55a1b] text-white text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Recharger</span>
            </button>

            {/* Lien natif volontaire : la racine a pu planter le routeur Next.js */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 text-sm font-semibold rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-colors"
            >
              <Home className="w-4 h-4 text-slate-400" />
              <span>Accueil</span>
            </a>
          </div>

          {error?.digest && (
            <div className="mt-6 pt-4 border-t border-slate-100">
              <span className="font-mono text-[11px] text-slate-400">
                Code incident : {error.digest}
              </span>
            </div>
          )}
        </div>
      </body>
    </html>
  );
}
