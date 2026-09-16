'use server';

import { cookies } from 'next/headers';
import { db } from '@/db';
import { profiles, notificationOutbox } from '@/db/schema';
import { eq, desc, and } from 'drizzle-orm';
import {
  listNotificationPreferences,
  setNotificationPreference,
  notify,
  NOTIFICATION_EVENTS,
} from '@/lib/notifications';
import { NotificationEvent, NotificationOutboxItem } from '@/types';

async function getCurrentUser() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value || cookieStore.get('buyerUserId')?.value;
  if (!userId) return null;
  const [profile] = await db.select({ id: profiles.id, phone: profiles.phone }).from(profiles).where(eq(profiles.id, userId)).limit(1);
  return profile || null;
}

export async function getNotificationPreferencesAction() {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized', preferences: [] };

  try {
    const prefs = await listNotificationPreferences(user.id);
    const events = Object.entries(NOTIFICATION_EVENTS).map(([key, def]) => {
      const row = prefs.find((p) => p.eventType === key);
      return {
        eventType: key as NotificationEvent,
        label: def.label,
        optIn: def.optIn,
        enabled: row ? row.enabled : true,
        phone: row?.phone || user.phone || '',
      };
    });
    return { success: true, error: undefined, preferences: events };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de chargement des préférences',
      preferences: [],
    };
  }
}

export async function setNotificationPreferenceAction(
  eventType: NotificationEvent,
  enabled: boolean,
  phone: string,
) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    await setNotificationPreference(user.id, phone || user.phone || '', eventType, enabled);
    return { success: true, error: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de mise à jour des préférences',
    };
  }
}

export async function fetchNotificationOutboxAction(limit: number = 50) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized', outbox: [] };

  try {
    const rows = await db
      .select()
      .from(notificationOutbox)
      .where(eq(notificationOutbox.recipientUserId, user.id))
      .orderBy(desc(notificationOutbox.createdAt))
      .limit(Math.min(200, Math.max(1, Number(limit) || 50)));

    return {
      success: true,
      error: undefined,
      outbox: rows.map((r) => ({
        id: r.id,
        recipientUserId: r.recipientUserId,
        recipientPhone: r.recipientPhone,
        eventType: r.eventType,
        title: r.title,
        body: r.body,
        provider: r.provider,
        status: (r.status as NotificationOutboxItem['status']) || 'PENDING',
        messageId: r.messageId,
        templateName: r.templateName,
        attempts: r.attempts,
        error: r.error,
        scheduledAt: r.scheduledAt ? (r.scheduledAt instanceof Date ? r.scheduledAt.toISOString() : String(r.scheduledAt)) : undefined,
        sentAt: r.sentAt ? (r.sentAt instanceof Date ? r.sentAt.toISOString() : String(r.sentAt)) : undefined,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      })),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de chargement des notifications',
      outbox: [],
    };
  }
}

/**
 * Action générique pour déclencher un événement de notification depuis le client
 * (ex. FACTURE_PAYEE, JALON_MILESTONE, RELANCE_PANIER_ABANDONNE).
 */
export async function sendEventNotificationAction(input: {
  eventType: NotificationEvent;
  phone?: string;
  title?: string;
  body: string;
  templateParams?: string[];
  scheduledAt?: string;
}) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  if (!input?.eventType || !input?.body) {
    return { success: false, error: 'Données incomplètes' };
  }

  try {
    const phone = input.phone || user.phone || '';
    await notify({
      userId: user.id,
      phone,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      templateParams: input.templateParams,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
    });
    return { success: true, error: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur d\'envoi de la notification',
    };
  }
}

export async function retryFailedNotificationAction(outboxId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: 'Unauthorized' };

  try {
    const [row] = await db
      .select()
      .from(notificationOutbox)
      .where(and(eq(notificationOutbox.id, outboxId), eq(notificationOutbox.recipientUserId, user.id)))
      .limit(1);
    if (!row) return { success: false, error: 'Notification introuvable' };
    if (row.status !== 'FAILED') return { success: true, error: undefined };

    await db
      .update(notificationOutbox)
      .set({ status: 'PENDING', attempts: 0, error: null })
      .where(eq(notificationOutbox.id, outboxId));
    return { success: true, error: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur de relance de la notification',
    };
  }
}