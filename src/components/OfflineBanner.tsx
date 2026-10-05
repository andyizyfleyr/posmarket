'use client';

import { useSyncExternalStore } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Bandeau hors-ligne global.
 *
 * `navigator.onLine` est une source externe : on la lit via
 * `useSyncExternalStore` (abonnement aux événements `online`/`offline`) plutôt
 * qu'un effet + état, ce qui évite un rendu en cascade et une valeur figée au
 * premier rendu serveur.
 */
const listeners = new Set<() => void>();

function subscribeToConnectivity(onStoreChange: () => void) {
  const handleChange = () => {
    listeners.forEach((listener) => listener());
    onStoreChange();
  };

  listeners.add(handleChange);
  window.addEventListener('online', handleChange);
  window.addEventListener('offline', handleChange);

  return () => {
    listeners.delete(handleChange);
    window.removeEventListener('online', handleChange);
    window.removeEventListener('offline', handleChange);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

export default function OfflineBanner() {
  const isOnline = useSyncExternalStore(subscribeToConnectivity, getSnapshot, () => true);

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-[99998] animate-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-950 text-white rounded-2xl shadow-2xl border border-orange-500/40 backdrop-blur-md">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-400 shrink-0">
          <WifiOff size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white leading-tight">
            Vous êtes hors ligne
          </p>
          <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
            Les pages déjà visitées et votre panier restent accessibles. La
            commande reprendra dès le retour du réseau.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-500 hover:bg-[#e55a1b] text-white text-[11px] font-bold transition-colors"
        >
          <RefreshCw size={12} />
          Réessayer
        </button>
      </div>
    </div>
  );
}