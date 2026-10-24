import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pushTokens } from '@/db/schema';

/**
 * Push Expo (application mobile).
 *
 * Le serveur n'a besoin d'aucune clé pour l'API Expo Push : il suffit des
 * jetons enregistrés par les appareils. Les jetons invalides signalés par Expo
 * (`DeviceNotRegistered`) sont désactivés pour ne pas gaspiller d'envois.
 */

export type PushChannelId = 'orders' | 'stock' | 'account' | 'promos';

export interface PushPayload {
  title: string;
  body: string;
  /** Route de l'application à ouvrir au clic (ex. `/account?tab=orders`). */
  url?: string;
  channelId?: PushChannelId;
  data?: Record<string, unknown>;
}

export interface PushResult {
  ok: boolean;
  sent: number;
  error?: string;
  ticketId?: string;
}

const EXPO_PUSH_ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const EXPO_TOKEN_RE = /^Expo(nent)?PushToken\[[^\]]+\]$/;

interface ExpoTicket {
  status?: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Jetons actifs d'un utilisateur (filtrés sur le format Expo). */
export async function getPushTokens(userId: string): Promise<string[]> {
  const rows = await db
    .select({ token: pushTokens.token })
    .from(pushTokens)
    .where(and(eq(pushTokens.userId, userId), eq(pushTokens.enabled, true)))
    .catch(() => [] as Array<{ token: string }>);
  return rows.map((row) => row.token).filter((token) => EXPO_TOKEN_RE.test(token));
}

/** Enregistre (ou réactive) le jeton d'un appareil pour un utilisateur. */
export async function registerPushToken(input: {
  userId: string;
  token: string;
  platform: 'ios' | 'android';
  deviceName?: string | null;
}): Promise<void> {
  await db
    .insert(pushTokens)
    .values({
      userId: input.userId,
      token: input.token,
      platform: input.platform,
      deviceName: input.deviceName || null,
      enabled: true,
    })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: {
        userId: input.userId,
        platform: input.platform,
        deviceName: input.deviceName || null,
        enabled: true,
        lastSeenAt: new Date(),
      },
    });
}

/** Désactive un jeton (déconnexion de l'appareil). */
export async function unregisterPushToken(token: string): Promise<void> {
  await db
    .update(pushTokens)
    .set({ enabled: false, lastSeenAt: new Date() })
    .where(eq(pushTokens.token, token));
}

async function disablePushTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  for (const token of tokens) {
    await db
      .update(pushTokens)
      .set({ enabled: false, lastSeenAt: new Date() })
      .where(eq(pushTokens.token, token))
      .catch(() => {});
  }
}

/**
 * Envoie une notification push à tous les appareils actifs d'un utilisateur.
 * Ne jette jamais : l'appelant décide de marquer la ligne en échec.
 */
export async function sendPush(userId: string, payload: PushPayload): Promise<PushResult> {
  const tokens = await getPushTokens(userId);
  if (tokens.length === 0) {
    return { ok: false, sent: 0, error: 'Aucun appareil enregistré pour cet utilisateur.' };
  }

  const messages = tokens.map((token) => ({
    to: token,
    title: payload.title,
    body: payload.body,
    sound: 'default',
    priority: 'high',
    channelId: payload.channelId || 'orders',
    data: {
      ...(payload.data || {}),
      url: payload.url || '/',
    },
  }));

  let response: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      response = await fetch(EXPO_PUSH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return {
      ok: false,
      sent: 0,
      error: error instanceof Error ? error.message : 'Réseau Expo Push indisponible.',
    };
  }

  if (!response.ok) {
    return { ok: false, sent: 0, error: `Expo Push ${response.status}` };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { ok: false, sent: 0, error: 'Réponse Expo Push illisible.' };
  }

  const body = (json || {}) as { data?: ExpoTicket | ExpoTicket[]; errors?: { message?: string }[] };
  const tickets = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];

  const invalidTokens: string[] = [];
  tickets.forEach((ticket, index) => {
    if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
      invalidTokens.push(tokens[index]);
    }
  });
  if (invalidTokens.length > 0) await disablePushTokens(invalidTokens);

  const accepted = tickets.filter((ticket) => ticket.status === 'ok');
  if (accepted.length === 0) {
    const error =
      tickets.find((ticket) => ticket.status === 'error')?.message ||
      body.errors?.[0]?.message ||
      'Envoi push refusé par Expo.';
    return { ok: false, sent: 0, error };
  }

  return { ok: true, sent: accepted.length, ticketId: accepted[0]?.id };
}
