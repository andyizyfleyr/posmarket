'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { ShieldAlert, X, ExternalLink, LogOut, ChevronUp, ChevronDown, UserCheck } from 'lucide-react';
import { ImpersonationCookiePayload } from '@/lib/impersonation';

export default function ImpersonationBanner() {
  const pathname = usePathname();
  const [data, setData] = useState<ImpersonationCookiePayload | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [isQuitting, setIsQuitting] = useState(false);

  useEffect(() => {
    // Ne pas afficher sur les pages internes de l'administration PAM
    if (pathname?.startsWith('/pam')) {
      setData(null);
      return;
    }

    try {
      const match = document.cookie
        .split('; ')
        .find((row) => row.startsWith('pam_impersonation='));
      if (match) {
        const rawValue = match.split('=')[1];
        if (rawValue) {
          const parsed = JSON.parse(decodeURIComponent(rawValue)) as ImpersonationCookiePayload;
          if (parsed && parsed.active) {
            setData(parsed);
          }
        }
      } else {
        setData(null);
      }
    } catch {
      setData(null);
    }
  }, [pathname]);

  if (!data || pathname?.startsWith('/pam')) {
    return null;
  }

  const handleQuit = async () => {
    setIsQuitting(true);
    try {
      await fetch('/pam/impersonate/stop', { method: 'POST' });
      // Essayer de fermer l'onglet s'il a été ouvert par script / target="_blank"
      window.close();
      // Si l'onglet ne se ferme pas automatiquement (sécurité navigateur), rediriger vers /pam
      window.location.href = '/pam';
    } catch {
      window.location.href = '/pam';
    }
  };

  if (minimized) {
    return (
      <div className="fixed bottom-4 right-4 z-[99999] animate-in fade-in slide-in-from-bottom-3 duration-200">
        <button
          onClick={() => setMinimized(false)}
          className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-full shadow-2xl border border-orange-500/40 text-xs font-bold hover:border-orange-400 hover:scale-105 transition-all group"
          title="Agrandir la bannière d'impersonation"
        >
          <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
          <UserCheck size={14} className="text-orange-400" />
          <span className="text-[11px] font-semibold text-slate-200">
            Impersonation : <strong className="text-orange-400">{data.userName || data.userEmail}</strong>
          </span>
          <ChevronUp size={14} className="text-slate-400 group-hover:text-white" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white border-b border-orange-500/40 shadow-2xl backdrop-blur-md animate-in slide-in-from-top duration-200">
      <div className="max-w-7xl mx-auto px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/40 text-orange-400 shrink-0">
            <ShieldAlert size={16} />
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-extrabold uppercase tracking-wider shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
              Mode Impersonation Admin
            </span>
            <span className="text-slate-300 font-medium truncate">
              Connecté sur le compte de <strong className="text-white font-bold">{data.userName || data.userEmail}</strong>
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold uppercase tracking-wider shrink-0">
              {data.isSuperAdmin ? 'Super Admin' : data.accountType === 'seller' ? 'Vendeur' : 'Acheteur'}
            </span>
            {data.adminUsername && (
              <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
                (Admin : {data.adminUsername})
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/pam"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all font-semibold text-[11px]"
            title="Ouvrir l'administration PAM dans un autre onglet"
          >
            <ExternalLink size={12} className="text-orange-400" />
            <span className="hidden sm:inline">Espace</span> PAM
          </a>

          <button
            onClick={handleQuit}
            disabled={isQuitting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/30 transition-all font-bold text-[11px] disabled:opacity-50"
            title="Fermer la session impersonée"
          >
            <LogOut size={12} />
            {isQuitting ? 'Fermeture...' : 'Quitter l’impersonation'}
          </button>

          <button
            onClick={() => setMinimized(true)}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            title="Réduire la bannière"
            aria-label="Réduire"
          >
            <ChevronDown size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
