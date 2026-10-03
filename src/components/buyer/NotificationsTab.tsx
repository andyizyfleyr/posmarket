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

type Channel = 'whatsapp' | 'email';

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

const STATUS_TONE: Record<string, string> = {
  SENT: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-amber-50 text-amber-700',
  SCHEDULED: 'bg-sky-50 text-sky-700',
  FAILED: 'bg-red-50 text-red-700',
  SKIPPED: 'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Envoyée',
  PENDING: 'En attente',
  SCHEDULED: 'Programmée',
  FAILED: 'En échec',
  SKIPPED: 'Ignorée',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_TONE[status] || STATUS_TONE.PENDING}`}>
      {STATUS_LABEL[status] || status}
    </span>
  );
}

interface ChannelToggleProps {
  row: PreferenceRow;
  channel: Channel;
  icon: React.ElementType;
  label: string;
  saving: boolean;
  onToggle: (row: PreferenceRow, channel: Channel, next: boolean) => void;
}

function ChannelToggle({ row, channel, icon: Icon, label, saving, onToggle }: ChannelToggleProps) {
  const conf = row[channel];

  if (!conf.hasAddress) {
    return (
      <div
        className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-200"
        title={`Renseignez votre ${channel === 'whatsapp' ? 'numéro de téléphone' : 'adresse e-mail'} dans l'onglet Profil pour activer ce canal.`}
      >
        <Icon size={14} className="text-gray-400 shrink-0" aria-hidden="true" />
        <span className="text-xs font-semibold text-gray-500">{label}</span>
        <MinusCircle size={14} className="text-gray-400 ml-auto shrink-0" aria-hidden="true" />
        <span className="sr-only">Non configuré</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={conf.enabled}
      aria-label={`Recevoir « ${row.label} » par ${label}`}
      onClick={() => onToggle(row, channel, !conf.enabled)}
      disabled={saving}
      className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition-colors disabled:opacity-60 ${
        conf.enabled
          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
          : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-300'
      }`}
    >
      {saving ? (
        <Loader2 size={14} className="animate-spin shrink-0" aria-hidden="true" />
      ) : (
        <Icon size={14} className="shrink-0" aria-hidden="true" />
      )}
      <span className="text-xs font-bold uppercase tracking-tight leading-tight flex-1">{label}</span>
      <span
        aria-hidden="true"
        className={`w-8 h-5 rounded-full relative p-0.5 transition-colors ${conf.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-all ${conf.enabled ? 'right-0.5' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

export const NotificationsTab: React.FC<NotificationsTabProps> = ({ notify }) => {
  const [preferences, setPreferences] = useState<PreferenceRow[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
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

  const handleToggle = useCallback(
    async (row: PreferenceRow, channel: Channel, next: boolean) => {
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
    },
    [notify],
  );

  // Une ligne est « active » dès qu'un canal est activé ou qu'une adresse est disponible.
  // Sans filtre, seules les lignes actionnables sont affichées.
  const visible = showInactive
    ? preferences
    : preferences.filter((p) => p.whatsapp.enabled || p.email.enabled || p.whatsapp.hasAddress || p.email.hasAddress);

  if (loading) {
    return (
      <div className="bg-white rounded-card border border-line shadow-sm p-8 flex flex-col items-center gap-3">
        <Loader2 size={22} className="animate-spin text-brand" aria-hidden="true" />
        <p className="text-sm font-semibold text-gray-500" role="status">Chargement des préférences…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-card border border-line shadow-sm p-5 md:p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-soft rounded-2xl flex items-center justify-center text-brand">
              <BellRing size={22} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-ink">Notifications</h3>
              <p className="text-xs text-gray-500 font-medium">
                Choisissez comment être prévenu (WhatsApp et/ou e-mail)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={load}
            className="p-2 text-gray-400 hover:text-brand rounded-lg transition-colors"
            aria-label="Rafraîchir les préférences"
          >
            <RefreshCcw size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3">
          {visible.length === 0 ? (
            <p className="text-sm font-medium text-gray-500 text-center py-6">
              Aucun canal configuré. Renseignez votre téléphone dans «&nbsp;Profil&nbsp;» pour activer WhatsApp.
            </p>
          ) : (
            visible.map((row) => (
              <div
                key={row.eventType}
                className="rounded-2xl border border-line p-4 bg-gray-50/50"
              >
                <div className="flex items-center justify-between gap-2 mb-3">
                  <p className="text-sm font-bold text-ink">{row.label}</p>
                  {row.optIn && (
                    <span className="text-xs font-semibold text-gray-600 px-2 py-0.5 rounded-full bg-gray-200">
                      Marketing
                    </span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <ChannelToggle
                    row={row}
                    channel="whatsapp"
                    icon={MessageCircle}
                    label="WhatsApp"
                    saving={savingKey === `${row.eventType}:whatsapp`}
                    onToggle={handleToggle}
                  />
                  <ChannelToggle
                    row={row}
                    channel="email"
                    icon={Mail}
                    label="E-mail"
                    saving={savingKey === `${row.eventType}:email`}
                    onToggle={handleToggle}
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            aria-pressed={showInactive}
            onClick={() => setShowInactive((v) => !v)}
            className="px-4 py-2.5 bg-brand-soft border border-brand/20 text-brand rounded-xl text-xs font-bold transition-colors"
          >
            {showInactive ? 'Masquer les inactives' : 'Tout afficher'}
          </button>
          <button
            type="button"
            aria-expanded={historyOpen}
            aria-controls="notifications-history"
            onClick={() => setHistoryOpen((v) => !v)}
            className="px-4 py-2.5 bg-gray-50 border border-line text-gray-600 rounded-xl text-xs font-bold transition-colors flex items-center gap-2"
          >
            <Inbox size={14} aria-hidden="true" />
            Historique ({outbox.length})
          </button>
        </div>
      </section>

      {historyOpen && (
        <section id="notifications-history" className="bg-white rounded-card border border-line shadow-sm p-5 md:p-6 space-y-3">
          <h3 className="text-sm font-bold text-ink">Dernières notifications</h3>
          {outbox.length === 0 ? (
            <p className="text-sm font-medium text-gray-500 text-center py-6">Aucune notification envoyée pour le moment.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {outbox.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-gray-50/50 border border-line rounded-xl"
                >
                  <div className="w-8 h-8 rounded-lg bg-white border border-line flex items-center justify-center text-gray-400 shrink-0">
                    {item.provider === 'email' ? <Mail size={14} aria-hidden="true" /> : <MessageCircle size={14} aria-hidden="true" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink truncate">{item.title || item.eventType}</p>
                    <p className="text-xs text-gray-500 font-medium truncate">{item.body}</p>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
};

export default NotificationsTab;