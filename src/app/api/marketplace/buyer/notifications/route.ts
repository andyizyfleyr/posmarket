import { NextRequest, NextResponse } from 'next/server';
import {
  fetchNotificationOutboxAction,
  getNotificationPreferencesAction,
  setNotificationPreferenceAction,
} from '@/lib/notification-actions';
import type { NotificationEvent } from '@/types';
import { requireBuyerSpace } from '@/lib/mobile-space';

export const dynamic = 'force-dynamic';

/**
 * GET /api/marketplace/buyer/notifications
 * Préférences de notification de l'acheteur connecté.
 * `?outbox=1&limit=30` renvoie l'historique des envois à la place.
 */
export async function GET(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const { searchParams } = new URL(req.url);
    const wantsOutbox = searchParams.get('outbox') === '1';
    const limit = Number(searchParams.get('limit')) || 30;
    const result = wantsOutbox
      ? await fetchNotificationOutboxAction(limit)
      : await getNotificationPreferencesAction();
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] buyer/notifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors du chargement des notifications' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/marketplace/buyer/notifications
 * Corps : `{ eventType, channel, enabled, whatsappPhone?, emailAddress? }`.
 */
export async function POST(req: NextRequest) {
  try {
    const guard = await requireBuyerSpace();
    if (!guard.ok) return guard.response;
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const eventType = String(body?.eventType || '') as NotificationEvent;
    const channel = body?.channel === 'email' ? 'email' : 'whatsapp';
    const enabled = Boolean(body?.enabled);
    if (!eventType) {
      return NextResponse.json({ success: false, error: 'Événement manquant.' });
    }
    const result = await setNotificationPreferenceAction(
      eventType,
      channel,
      enabled,
      String(body?.whatsappPhone || ''),
      String(body?.emailAddress || ''),
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error('[API] set buyer notification preference error:', error);
    return NextResponse.json(
      { success: false, error: 'Erreur lors de la mise à jour.' },
      { status: 500 },
    );
  }
}
