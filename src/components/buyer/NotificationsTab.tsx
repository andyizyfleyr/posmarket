'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { BellRing, Mail, MessageCircle, Loader2, RefreshCcw, Inbox, MinusCircle } from 'lucide-react';
import {
  getNotificationPreferencesAction,
  setNotificationPreferenceAction,
  fetchNotificationOutboxAction,
} from '@/lib/notification-actions';
import type { NotificationEvent } from '@/types';
import { NotifyFn } from './accountTypes';

interface PreferenceRow {
  eventType: NotificationEvent;
  label: string;
  optIn: boolean;
  whatsapp: { enabled: boolean; hasAddress: boolean; phone: string };
  email: { enabled: boolean; hasAddress: boolean; email: string };
}

interface OutboxItem {
  id: string;
  eventType: string;
  title: string | null;
  body: string;
  provider: string;
  status: string;
  createdAt?: string;
}

interface NotificationsTabProps {
  notify?: NotifyFn;
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ notify }) => {
  const [preferences, setPreferences] = useState<PreferenceRow[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefsRes, outboxRes] = await Promise.all([
        getNotificationPreferencesAction(),
        fetchNotificationOutboxAction(30),
      ]);
      if (prefsRes?.success && Array.isArray(prefsRes.preferences)) {
        setPreferences(prefsRes.preferences as PreferenceRow[]);
      } else if (prefsRes?.error === 'Unauthorized') {
        notify?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
      }
      if (outboxRes?.success && Array.isArray(outboxRes.outbox)) {
        setOutbox(outboxRes.outbox as OutboxItem[]);
      }
    } catch {
      notify?.('Impossible de charger vos préférences de notifications.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (row: PreferenceRow, channel: 'whatsapp' | 'email', next: boolean) => {
    const key = `${row.eventType}:${channel}`;
    setSavingKey(key);
    try {
      const res = await setNotificationPreferenceAction(
        row.eventType,
        channel,
        next,
        row.whatsapp.phone,
        row.email.email,
      );
      if (res?.success) {
        setPreferences((prev) =>
          prev.map((p) =>
            p.eventType === row.eventType
              ? { ...p, [channel]: { ...p[channel], enabled: next } }
              : p,
          ),
        );
      } else if (res?.error === 'Unauthorized') {
        notify?.('Session expirée, veuillez vous reconnecter.', 'info', 'Connexion');
      } else {
        notify?.(res?.error || 'Mise à jour impossible.', 'error');
      }
    } catch {
      notify?.('Erreur de connexion. Veuillez réessayer.', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const visible =
    preferences.length > 0
      ? preferences.filter((p) => showAll || (!p.optIn && (p.whatsapp.enabled || p.email.enabled || p.whatsapp.hasAddress || p.email.hasAddress)))
      : [];

  const ChannelToggle: React.FC<{
    row: PreferenceRow;
    channel: 'whatsapp' | 'email';
    icon: React.ElementType;
    label: string;
  }> = ({ row, channel, icon: Icon, label }) => {
    const conf = row[channel];
    const key = `${row.eventType}:${channel}`;
    const isSaving = savingKey === key;
    if (!conf.hasAddress) {
      return (
        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
          <Icon size={14} className="text-gray-300 shrink-0" />
          <span className="text-[10px] font-semibold text-gray-300">{label}</span>
          <MinusCircle size={12} className="text-gray-300 ml-auto shrink-0" />
        </div>
      );
    }
    return (
      <button
        onClick={() => toggle(row, channel, !conf.enabled)}
        disabled={isSaving}
        className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-[0.98] disabled:opacity-60 ${
          conf.enabled
            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
            : 'bg-gray-50 border-gray-100 text-gray-400'
        }`}
      >
        {isSaving ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Icon size={14} className="shrink-0" />}
        <span className="text-[10px] font-bold uppercase tracking-tight leading-tight flex-1">{label}</span>
        <span className={`w-8 h-5 rounded-full relative p-0.5 transition-colors ${conf.enabled ? 'bg-emerald-500' : 'bg-gray-200'}`}>
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${conf.enabled ? 'right-0.5' : 'left-0.5'}`} />
        </span>
      </button>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      SENT: 'bg-emerald-50 text-emerald-600',
      PENDING: 'bg-amber-50 text-amber-600',
      SCHEDULED: 'bg-blue-50 text-blue-600',
      FAILED: 'bg-red-50 text-red-600',
      SKIPPED: 'bg-gray-50 text-gray-400',
    };
    const labels: Record<string, string> = {
      SENT: 'Envoyée',
      PENDING: 'En attente',
      SCHEDULED: 'Programmée',
      FAILED: 'En échec',
      SKIPPED: 'Ignorée',
    };
    return (
      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${map[status] || map.PENDING}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-8 flex flex-col items-center gap-3">
        <Loader2 size={22} className="animate-spin text-[#f56b2a]" />
        <p className="text-[11px] font-semibold text-gray-400">Chargement des préférences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 md:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-[#f56b2a]">
              <BellRing size={22} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#002f34]">Notifications</h3>
              <p className="text-[10px] text-gray-400 font-semibold">
                Choisissez comment être prévenu (WhatsApp et/ou E-mail)
              </p>
            </div>
          </div>
          <button
            onClick={load}
            className="p-2 text-gray-300 hover:text-[#f56b2a] active:scale-90 transition-transform"
            aria-label="Rafraîchir les préférences"
          >
            <RefreshCcw size={16} />
          </button>
        </div>

        <div className="space-y-3">
          {visible.length === 0 && (
            <p className="text-[11px] font-semibold text-gray-400 text-center py-6">
              Aucun canal configuré. Renseignez votre téléphone dans « Profil » pour activer WhatsApp.
            </p>
          )}
          {visible.map((row) => (
            <div
              key={row.eventType}
              className={`rounded-2xl border p-4 transition-colors ${
                row.optIn ? 'bg-violet-50/40 border-violet-100' : 'bg-gray-50/50 border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs font-bold text-[#002f34]">{row.label}</p>
                {row.optIn && (
                  <span className="text-[8px] font-bold uppercase tracking-wider text-violet-500 px-2 py-0.5 rounded-full bg-violet-100">
                    Marketing
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <ChannelToggle row={row} channel="whatsapp" icon={MessageCircle} label="WhatsApp" />
                <ChannelToggle row={row} channel="email" icon={Mail} label="E-mail" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => setShowAll((v) => !v)}
            className="px-4 py-2.5 bg-[#f56b2a]/5 border border-[#f56b2a]/15 text-[#f56b2a] rounded-xl text-[10px] font-bold uppercase tracking-tight active:scale-[0.98] transition-transform"
          >
            {showAll ? 'Masquer l\'inactif' : 'Tout afficher'}
          </button>
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="px-4 py-2.5 bg-gray-50 border border-gray-100 text-gray-500 rounded-xl text-[10px] font-bold uppercase tracking-tight active:scale-[0.98] transition-transform flex items-center gap-2"
          >
            <Inbox size={14} />
            Historique ({outbox.length})
          </button>
        </div>
      </div>

      {historyOpen && (
        <div className="bg-white rounded-[24px] border border-gray-100 shadow-sm p-5 md:p-6 space-y-3">
          <h3 className="text-sm font-bold text-[#002f34]">Dernières notifications</h3>
          {outbox.length === 0 && (
            <p className="text-[11px] font-semibold text-gray-300 text-center py-6">Aucune notification envoyée pour le moment.</p>
          )}
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {outbox.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50/50 border border-gray-100 rounded-xl">
                <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                  {item.provider === 'email' ? <Mail size={14} /> : <MessageCircle size={14} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[#002f34] truncate">{item.title || item.eventType}</p>
                  <p className="text-[10px] text-gray-400 font-semibold truncate">{item.body}</p>
                </div>
                {statusBadge(item.status)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsTab;