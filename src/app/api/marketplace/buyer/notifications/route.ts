import { NextRequest, NextResponse } from 'next/server';
import {
  fetchNotificationOutboxAction,
  getNotificationPreferencesAction,
  setNotificationPreferenceAction,
} from '@/lib/notification-actions';
import type { NotificationEvent } from '@/types';
import { requireBuyerSpace } from '@/lib/mobile-space';
import { parseBody } from '@/lib/validation';
import { buyerNotificationSchema } from '@/lib/schemas';

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
    const parsed = await parseBody(req, buyerNotificationSchema);
    if (!parsed.ok) return parsed.response;
    const { eventType, channel, enabled } = parsed.data;
    const result = await setNotificationPreferenceAction(
      eventType as NotificationEvent,
      channel,
      enabled,
      parsed.data.whatsappPhone ?? '',
      parsed.data.emailAddress ?? '',
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
