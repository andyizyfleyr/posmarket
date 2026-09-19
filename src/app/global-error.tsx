'use client';

import React from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalRootError({ error, reset }: GlobalErrorProps) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-[#fffaf7] text-gray-900 font-sans flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 border border-orange-100 shadow-2xl text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-orange-100 text-[#f56b2a] flex items-center justify-center text-2xl font-bold">
            ⚡
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            PosMarket — Erreur d&apos;affichage
          </h1>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed font-normal">
            Une interruption est survenue lors du chargement. Cliquez ci-dessous pour recharger l&apos;application en toute sécurité.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => reset ? reset() : window.location.reload()}
              className="w-full py-3.5 px-6 bg-[#f56b2a] hover:bg-[#e45a19] text-white font-bold text-sm rounded-2xl shadow-lg shadow-[#f56b2a]/30 transition-all cursor-pointer"
            >
              Recharger la page
            </button>
            <a
              href="/"
              className="w-full py-3 px-6 bg-gray-50 hover:bg-gray-100 text-gray-800 font-semibold text-sm rounded-2xl border border-gray-200 transition-all text-center"
            >
              Retour au catalogue
            </a>
          </div>
          {error?.digest && (
            <p className="text-[10px] text-gray-400 mt-6 font-mono">
              Code incident : {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
