import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { notificationOutbox } from '@/db/schema';

export const dynamic = 'force-dynamic';

/**
 * Webhook WhatsApp Cloud API (Meta).
 *
 * GET  : vérification du endpoint ("Vérifier le token" dans l'étape Webhooks).
 * POST : réception des événements entrants :
 *        - value.statuses -> mise à jour du statut des messages envoyés
 *          (SENT -> DELIVERED -> READ) dans notification_outbox
 *        - value.messages -> messages entrants (non traités pour l'instant)
 */

function verifyWebhookToken(token: string | null): boolean {
  if (!token) return false;
  // Fallback : valeur partagée avec le client (à remplacer par l'env Vercel dès que possible)
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '778e6c6bbf0854fd56ad2edc90920e10313f4b652f3127ca';
  return expected.length > 0 && token === expected;
}

function isValidSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return true;
  if (!signatureHeader) return false;
  const prefix = 'sha256=';
  if (!signatureHeader.startsWith(prefix)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const received = signatureHeader.slice(prefix.length);
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode');
  const token = request.nextUrl.searchParams.get('hub.verify_token');
  const challenge = request.nextUrl.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && verifyWebhookToken(token)) {
    return new NextResponse(challenge || 'ok', { status: 200 });
  }
  return new NextResponse('Verification token mismatch', { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  if (!isValidSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: {
    entry?: Array<{
      changes?: Array<{
        value?: {
          statuses?: Array<{ id?: string; status?: string; timestamp?: string }>;
          messages?: unknown[];
        };
      }>;
    }>;
  } = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  try {
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const status of value.statuses || []) {
          if (!status.id) continue;
          const metaStatus = String(status.status || '').toUpperCase();
          const outboxStatus =
            metaStatus === 'READ' ? 'SENT' :
            metaStatus === 'DELIVERED' ? 'SENT' :
            metaStatus === 'SENT' ? 'SENT' : null;
          if (outboxStatus) {
            await db
              .update(notificationOutbox)
              .set({ status: outboxStatus })
              .where(eq(notificationOutbox.messageId, status.id));
          }
        }
        // value.messages : messages entrants (réponses) — à traiter selon besoin.
      }
    }
  } catch (e) {
    console.error('[whatsapp-webhook] error:', e);
  }

  return NextResponse.json({ received: true });
}