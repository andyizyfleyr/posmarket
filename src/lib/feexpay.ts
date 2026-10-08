import crypto from 'node:crypto';

export type FeexpayEnv = 'sandbox' | 'live';

export let FEEXPAY_ENV: FeexpayEnv = 'sandbox';
// Le SDK officiel (JS + PHP) pointe toujours vers api-v2.feexpay.me :
// le mode (LIVE / SANDBOX) est transmis dans la requête, pas dans l'hôte.
export const FEEXPAY_API_BASE = 'https://api-v2.feexpay.me';

export let FEEXPAY_SHOP_ID = '';
export let FEEXPAY_API_KEY = '';
export let FEEXPAY_SECRET_KEY = '';
export let FEEXPAY_WEBHOOK_SECRET = '';

export function initFeexpayConfig(config: {
  shopId?: string;
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  env?: FeexpayEnv;
}) {
  FEEXPAY_SHOP_ID = config.shopId?.trim() || '';
  FEEXPAY_API_KEY = config.apiKey?.trim() || '';
  FEEXPAY_SECRET_KEY = config.secretKey?.trim() || '';
  FEEXPAY_WEBHOOK_SECRET = config.webhookSecret?.trim() || '';
  FEEXPAY_ENV = config.env === 'live' ? 'live' : 'sandbox';
}

export function feexpayConfigured(): boolean {
  return Boolean(FEEXPAY_SHOP_ID && FEEXPAY_API_KEY);
}

/** Reconnu comme « paiement abouti » quel que soit le libellé renvoyé par FeexPay. */
export function isFeexpayApprovedStatus(status: string): boolean {
  const s = String(status || '').trim().toLowerCase();
  return ['successful', 'success', 'approved', 'completed', 'paid', 'transferred', 'accepted'].includes(s);
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * FeexPay n'expose pas (doc REST) de format de signature unique : on accepte
 * le HMAC SHA-256 de la clé secrète webhooks ainsi que le hash SHA-256 brut
 * du payload, schémas employés par leurs SDKs.
 */
export function verifyFeexpayWebhookSignature(payloadRaw: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const header = String(signatureHeader).trim();
  if (!header) return false;

  const sha256 = crypto.createHash('sha256').update(payloadRaw).digest('hex');
  if (safeEqual(header, sha256)) return true;

  if (FEEXPAY_WEBHOOK_SECRET) {
    const hmac = crypto.createHmac('sha256', FEEXPAY_WEBHOOK_SECRET).update(payloadRaw).digest('hex');
    if (safeEqual(header, hmac)) return true;
    if (safeEqual(header, FEEXPAY_WEBHOOK_SECRET)) return true;
  }
  return false;
}

export interface FeexpayTransactionStatus {
  transactionId?: string;
  reference?: string;
  status: string;
  amount: number;
  currency?: string;
  phoneNumber?: string;
  [key: string]: unknown;
}

/**
 * Statut d'une transaction via l'endpoint public v2 :
 * GET /api/transactions/public/single/status/{reference} (auth Bearer).
 */
export async function verifyFeexpayTransaction(reference: string): Promise<FeexpayTransactionStatus> {
  if (!feexpayConfigured()) {
    throw new Error('Clés API FeexPay non configurées');
  }
  const ref = String(reference || '').trim();
  if (!ref) {
    throw new Error('Référence de transaction FeexPay manquante');
  }

  const res = await fetch(`${FEEXPAY_API_BASE}/api/transactions/public/single/status/${encodeURIComponent(ref)}`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Authorization': `Bearer ${FEEXPAY_API_KEY}`,
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let body: Record<string, unknown> | null = null;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    const reason =
      (body as { message?: string; reason?: string } | null)?.message ||
      (body as { message?: string; reason?: string } | null)?.reason ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(`FeexPay API ${res.status} : ${reason}`);
  }

  const raw = body || {};
  const data = (raw.transaction || raw.data || raw) as Record<string, unknown>;

  return {
    transactionId: String(data.transactionId || data.id || ref),
    reference: String(data.reference || ref),
    status: String(data.status || raw.status || '').toLowerCase(),
    amount: Number(data.amount ?? raw.amount ?? 0),
    currency: String(data.currency || raw.currency || 'XOF'),
    phoneNumber: String(data.phoneNumber || data.phone_number || ''),
    ...(data),
  } as FeexpayTransactionStatus;
}
