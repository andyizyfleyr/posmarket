/**
 * Onglet « Alertes » (notifications) — copie mobile de
 * `src/components/buyer/NotificationsTab.tsx` du web : préférences WhatsApp /
 * e-mail par événement et historique des envois. Masqué de la navigation par
 * tuiles, accessible via `/account?tab=notifications`.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  BellRing,
  Inbox,
  Mail,
  MessageCircle,
  MinusCircle,
  RefreshCcw,
} from 'lucide-react-native';
import {
  fetchNotificationOutbox,
  fetchNotificationPreferences,
  setNotificationPreference,
} from '@/api/client';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ToastProvider';
import type { NotificationOutboxItem, NotificationPreference } from '@/types';
import { COLORS } from '@/theme';

type Channel = 'whatsapp' | 'email';

const STATUS_TONE: Record<string, { background: string; color: string }> = {
  SENT: { background: '#ECFDF5', color: '#047857' },
  PENDING: { background: '#FFFBEB', color: '#B45309' },
  SCHEDULED: { background: '#F0F9FF', color: '#0369A1' },
  FAILED: { background: '#FEF2F2', color: '#B91C1C' },
  SKIPPED: { background: '#F3F4F6', color: '#6B7280' },
};

const STATUS_LABEL: Record<string, string> = {
  SENT: 'Envoyée',
  PENDING: 'En attente',
  SCHEDULED: 'Programmée',
  FAILED: 'En échec',
  SKIPPED: 'Ignorée',
};

interface ChannelToggleProps {
  row: NotificationPreference;
  channel: Channel;
  label: string;
  icon: React.ReactNode;
  saving: boolean;
  onToggle: (row: NotificationPreference, channel: Channel, next: boolean) => void;
}

function ChannelToggle({ row, channel, label, icon, saving, onToggle }: ChannelToggleProps) {
  const conf = row[channel];

  if (!conf.hasAddress) {
    return (
      <View style={styles.channelLocked}>
        {icon}
        <Text style={styles.channelLabelMuted}>{label}</Text>
        <View style={styles.lockedRight}>
          <MinusCircle size={14} color="#9CA3AF" />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => onToggle(row, channel, !conf.enabled)}
      disabled={saving}
      accessibilityRole="switch"
      accessibilityState={{ checked: conf.enabled }}
      accessibilityLabel={`Recevoir « ${row.label} » par ${label}`}
      style={[
        styles.channel,
        conf.enabled ? styles.channelOn : styles.channelOff,
        saving && styles.disabled,
      ]}
    >
      {saving ? <ActivityIndicator size="small" color={COLORS.brand} /> : icon}
      <Text
        style={[styles.channelLabel, conf.enabled && styles.channelLabelOn]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={[styles.switch, conf.enabled ? styles.switchOn : styles.switchOff]}>
        <View style={[styles.knob, conf.enabled ? styles.knobOn : styles.knobOff]} />
      </View>
    </Pressable>
  );
}

export const NotificationsTab: React.FC = () => {
  const { notify } = useToast();
  const { sessionExpired } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [outbox, setOutbox] = useState<NotificationOutboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prefsRes, outboxRes] = await Promise.all([
        fetchNotificationPreferences(),
        fetchNotificationOutbox(30),
      ]);
      if (prefsRes?.success && Array.isArray(prefsRes.preferences)) {
        setPreferences(prefsRes.preferences);
      } else if (prefsRes?.error === 'Unauthorized') {
        sessionExpired();
      }
      if (outboxRes?.success && Array.isArray(outboxRes.outbox)) {
        setOutbox(outboxRes.outbox);
      }
    } catch {
      notify('Impossible de charger vos préférences de notifications.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, sessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleToggle = useCallback(
    async (row: NotificationPreference, channel: Channel, next: boolean) => {
      const key = `${row.eventType}:${channel}`;
      setSavingKey(key);
      try {
        const res = await setNotificationPreference({
          eventType: row.eventType,
          channel,
          enabled: next,
          whatsappPhone: row.whatsapp.phone,
          emailAddress: row.email.email,
        });
        if (res?.success) {
          setPreferences((prev) =>
            prev.map((p) =>
              p.eventType === row.eventType
                ? { ...p, [channel]: { ...p[channel], enabled: next } }
                : p,
            ),
          );
        } else if (res?.error === 'Unauthorized') {
          sessionExpired();
        } else {
          notify(res?.error || 'Mise à jour impossible.', 'error');
        }
      } catch {
        notify('Erreur de connexion. Veuillez réessayer.', 'error');
      } finally {
        setSavingKey(null);
      }
    },
    [notify, sessionExpired],
  );

  // Une ligne est « active » dès qu'un canal est activé ou qu'une adresse est
  // disponible. Sans filtre, seules les lignes actionnables sont affichées.
  const visible = showInactive
    ? preferences
    : preferences.filter(
        (p) =>
          p.whatsapp.enabled ||
          p.email.enabled ||
          p.whatsapp.hasAddress ||
          p.email.hasAddress,
      );

  if (loading) {
    return (
      <View style={styles.loadingCard}>
        <ActivityIndicator size="small" color={COLORS.brand} />
        <Text style={styles.loadingText}>Chargement des préférences…</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <View style={styles.sectionHeadLeft}>
            <View style={styles.bellBox}>
              <BellRing size={22} color={COLORS.brand} />
            </View>
            <View style={styles.sectionHeadText}>
              <Text style={styles.sectionTitle}>Notifications</Text>
              <Text style={styles.sectionSubtitle}>
                Choisissez comment être prévenu (WhatsApp et/ou e-mail)
              </Text>
            </View>
          </View>
          <Pressable onPress={load} hitSlop={8} accessibilityLabel="Rafraîchir les préférences">
            <RefreshCcw size={16} color="#9CA3AF" />
          </Pressable>
        </View>

        <View style={styles.prefsList}>
          {visible.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucun canal configuré. Renseignez votre téléphone dans « Profil » pour activer
              WhatsApp.
            </Text>
          ) : (
            visible.map((row) => (
              <View key={row.eventType} style={styles.prefRow}>
                <View style={styles.prefRowHead}>
                  <Text style={styles.prefLabel}>{row.label}</Text>
                  {row.optIn ? (
                    <View style={styles.marketingTag}>
                      <Text style={styles.marketingText}>Marketing</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.channels}>
                  <ChannelToggle
                    row={row}
                    channel="whatsapp"
                    label="WhatsApp"
                    icon={<MessageCircle size={14} color="#4B5563" />}
                    saving={savingKey === `${row.eventType}:whatsapp`}
                    onToggle={handleToggle}
                  />
                  <ChannelToggle
                    row={row}
                    channel="email"
                    label="E-mail"
                    icon={<Mail size={14} color="#4B5563" />}
                    saving={savingKey === `${row.eventType}:email`}
                    onToggle={handleToggle}
                  />
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setShowInactive((v) => !v)}
            style={styles.toolbarBtnBrand}
          >
            <Text style={styles.toolbarTextBrand}>
              {showInactive ? 'Masquer les inactives' : 'Tout afficher'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setHistoryOpen((v) => !v)}
            style={styles.toolbarBtn}
          >
            <Inbox size={14} color="#4B5563" />
            <Text style={styles.toolbarText}>Historique ({outbox.length})</Text>
          </Pressable>
        </View>
      </View>

      {historyOpen && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dernières notifications</Text>
          {outbox.length === 0 ? (
            <Text style={styles.emptyText}>
              Aucune notification envoyée pour le moment.
            </Text>
          ) : (
            <View style={styles.outboxList}>
              {outbox.map((item) => {
                const tone = STATUS_TONE[item.status] || STATUS_TONE.PENDING;
                return (
                  <View key={item.id} style={styles.outboxRow}>
                    <View style={styles.outboxIcon}>
                      {item.provider === 'email' ? (
                        <Mail size={14} color="#9CA3AF" />
                      ) : (
                        <MessageCircle size={14} color="#9CA3AF" />
                      )}
                    </View>
                    <View style={styles.outboxText}>
                      <Text style={styles.outboxTitle} numberOfLines={1}>
                        {item.title || item.eventType}
                      </Text>
                      <Text style={styles.outboxBody} numberOfLines={1}>
                        {item.body}
                      </Text>
                    </View>
                    <View style={[styles.statusTag, { backgroundColor: tone.background }]}>
                      <Text style={[styles.statusText, { color: tone.color }]}>
                        {STATUS_LABEL[item.status] || item.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    gap: 16,
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 20,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeadLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    minWidth: 0,
  },
  bellBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadText: {
    flex: 1,
    minWidth: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  prefsList: {
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    textAlign: 'center',
    paddingVertical: 24,
  },
  prefRow: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 16,
    backgroundColor: 'rgba(249,250,251,0.5)',
  },
  prefRowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  prefLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
    flex: 1,
  },
  marketingTag: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  marketingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  channels: {
    gap: 8,
  },
  channel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  channelOn: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  channelOff: {
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
  },
  channelLocked: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lockedRight: {
    marginLeft: 'auto',
  },
  channelLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    color: '#4B5563',
  },
  channelLabelOn: {
    color: '#065F46',
  },
  channelLabelMuted: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  switch: {
    width: 32,
    height: 20,
    borderRadius: 999,
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: '#10B981',
  },
  switchOff: {
    backgroundColor: '#D1D5DB',
  },
  knob: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 1,
  },
  knobOn: {
    alignSelf: 'flex-end',
  },
  knobOff: {
    alignSelf: 'flex-start',
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 4,
  },
  toolbarBtnBrand: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: COLORS.brandSoft,
    borderWidth: 1,
    borderColor: 'rgba(245,107,42,0.2)',
    borderRadius: 12,
  },
  toolbarTextBrand: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.brand,
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
  },
  toolbarText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  outboxList: {
    gap: 8,
  },
  outboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: 'rgba(249,250,251,0.5)',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 12,
  },
  outboxIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outboxText: {
    flex: 1,
    minWidth: 0,
  },
  outboxTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.ink,
  },
  outboxBody: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.6,
  },
});

export default NotificationsTab;
