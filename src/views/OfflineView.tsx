'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle2,
  Home,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
  WifiZero,
} from 'lucide-react';

type ConnectionStatus = 'checking' | 'offline' | 'online';

const PROBE_URL = '/manifest.json';
const PROBE_TIMEOUT_MS = 5000;

/**
 * Vérifie une vraie connexion Internet, pas seulement l'interface réseau.
 * `navigator.onLine` peut rester à `true` derrière un portail captif ou un
 * Wi-Fi sans accès Internet. La requête est volontairement hors cache.
 */
async function hasRealConnection(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(
    () => controller.abort(),
    PROBE_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${PROBE_URL}?probe=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timeout);
  }
}

function getSafeReturnTo(): string {
  if (typeof window === 'undefined') return '/';

  try {
    const referrer = document.referrer;
    if (referrer) {
      const url = new URL(referrer);
      if (
        url.origin === window.location.origin &&
        !url.pathname.startsWith('/offline')
      ) {
        return `${url.pathname}${url.search}${url.hash}`;
      }
    }

    const stored = window.sessionStorage.getItem('posmarket:last-page');
    if (stored && stored.startsWith('/') && !stored.startsWith('/offline')) {
      return stored;
    }
  } catch {
    // Stockage indisponible (navigation privée stricte) : accueil par défaut.
  }

  return '/';
}

export default function OfflineView() {
  const [status, setStatus] = useState<ConnectionStatus>('checking');
  const [returnTo, setReturnTo] = useState('/');
  const [hasRetried, setHasRetried] = useState(false);
  const mountedRef = useRef(true);

  const verifyConnection = useCallback(async (showChecking = true) => {
    if (showChecking) setStatus('checking');
    const connected = await hasRealConnection();
    if (!mountedRef.current) return;
    setStatus(connected ? 'online' : 'offline');
    setHasRetried(true);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    setReturnTo(getSafeReturnTo());

    const initialCheck = window.setTimeout(() => {
      void verifyConnection(false);
    }, 0);

    const handleOnline = () => {
      void verifyConnection(false);
    };
    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(initialCheck);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [verifyConnection]);

  const handleBack = () => {
    if (returnTo !== '/') {
      window.location.assign(returnTo);
      return;
    }

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.location.assign('/');
  };

  const isChecking = status === 'checking';
  const isOnline = status === 'online';
  const title = isChecking
    ? 'Vérification de la connexion…'
    : isOnline
      ? 'Connexion rétablie'
      : 'Pas de connexion Internet';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fffaf7] via-white to-[#f8fafc] flex flex-col justify-between selection:bg-brand/20 selection:text-brand">
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand to-[#ff8c42] flex items-center justify-center text-white shadow-lg shadow-brand/25 group-hover:scale-105 transition-transform duration-300">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xl tracking-tight text-gray-950">
              Pos<span className="text-brand">Market</span>
            </span>
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest -mt-1">
              Express Marketplace
            </span>
          </div>
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-700 hover:text-gray-900 bg-white/90 hover:bg-white border border-gray-200/80 rounded-full shadow-sm backdrop-blur-sm transition-all"
        >
          <Home className="w-3.5 h-3.5 text-brand" />
          <span>Accueil</span>
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="w-full max-w-xl mx-auto">
          <div
            className="relative bg-white rounded-3xl border border-orange-100/90 shadow-xl shadow-orange-900/5 p-6 sm:p-10 text-center overflow-hidden"
            aria-live="polite"
          >
            <div className="absolute -top-24 -right-24 w-52 h-52 bg-orange-200/25 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-52 h-52 bg-amber-200/25 rounded-full blur-3xl pointer-events-none" />

            <div className="relative mx-auto w-20 h-20 mb-6 flex items-center justify-center">
              {isOnline ? (
                <div className="w-20 h-20 rounded-full bg-emerald-50 border-2 border-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600" />
                </div>
              ) : (
                <>
                  {!isChecking && (
                    <div className="absolute inset-0 rounded-full bg-orange-100/70 animate-ping opacity-40" />
                  )}
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-orange-50 to-orange-100/80 border-2 border-orange-200/60 flex items-center justify-center shadow-inner">
                    {isChecking ? (
                      <Wifi className="w-9 h-9 text-brand animate-pulse" />
                    ) : (
                      <WifiOff className="w-9 h-9 text-brand" />
                    )}
                  </div>
                </>
              )}
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                isOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                  : isChecking
                    ? 'bg-orange-50 text-brand border-orange-100'
                    : 'bg-rose-50 text-rose-600 border-rose-100'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isOnline
                    ? 'bg-emerald-500'
                    : isChecking
                      ? 'bg-brand animate-pulse'
                      : 'bg-rose-500'
                }`}
              />
              {isOnline
                ? 'En ligne'
                : isChecking
                  ? 'Vérification'
                  : 'Hors ligne'}
            </span>

            <h1 className="mt-4 text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              {title}
            </h1>
            <p className="mt-2 text-sm sm:text-base text-gray-500 leading-relaxed max-w-md mx-auto">
              {isOnline
                ? 'Votre appareil a retrouvé une connexion. Vous pouvez reprendre votre navigation en toute sécurité.'
                : isChecking
                  ? 'Nous vérifions que votre appareil peut bien joindre Internet…'
                  : 'Vérifiez votre Wi-Fi ou vos données mobiles, puis réessayez. Votre panier et vos informations sont conservés.'}
            </p>

            <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => void verifyConnection(true)}
                disabled={isChecking}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-gradient-to-r from-brand to-[#ff7d3b] hover:from-[#e45a19] hover:to-brand text-white text-sm font-bold rounded-2xl shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-wait cursor-pointer"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`}
                />
                <span>
                  {isChecking
                    ? 'Vérification…'
                    : isOnline
                      ? 'Vérifier à nouveau'
                      : 'Réessayer'}
                </span>
              </button>

              <button
                type="button"
                onClick={handleBack}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-gray-50 hover:bg-gray-100 text-gray-800 text-sm font-bold rounded-2xl border border-gray-200/80 hover:border-gray-300 hover:-translate-y-0.5 active:translate-y-0 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 text-gray-500" />
                <span>
                  {isOnline
                    ? returnTo === '/'
                      ? "Retour à l'accueil"
                      : 'Revenir à ma page'
                    : 'Page précédente'}
                </span>
              </button>
            </div>

            {!isOnline && !isChecking && hasRetried && (
              <p className="mt-4 text-xs font-medium text-rose-500">
                La connexion est toujours indisponible. Réessayez dans quelques
                instants.
              </p>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100 text-left">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <WifiZero className="w-3.5 h-3.5 text-brand" />
                Que faire maintenant ?
              </p>
              <ul className="grid gap-2.5 sm:grid-cols-3">
                {[
                  'Vérifiez que le Wi-Fi ou les données mobiles sont activés.',
                  'Désactivez puis réactivez le mode avion.',
                  'Éloignez-vous des zones sans couverture, puis réessayez.',
                ].map((tip) => (
                  <li
                    key={tip}
                    className="rounded-2xl bg-gray-50/80 border border-gray-100 px-3.5 py-3 text-[11px] leading-relaxed text-gray-600"
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] font-medium text-gray-400">
            Astuce : cette page est disponible hors ligne. Votre panier reste
            enregistré sur cet appareil.
          </p>
        </div>
      </main>

      <footer className="w-full max-w-7xl mx-auto px-4 py-6 text-center text-xs font-medium text-gray-400">
        © {new Date().getFullYear()} PosMarket. Tous droits réservés.
      </footer>
    </div>
  );
}
