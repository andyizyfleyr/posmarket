import crypto from 'node:crypto';

export let KKIAPAY_ENV = process.env.KKIAPAY_ENV === 'live' ? 'live' : 'sandbox';
export let KKIAPAY_API_BASE = KKIAPAY_ENV === 'live'
  ? 'https://api.kkiapay.me'
  : 'https://api-sandbox.kkiapay.me';

export let KKIAPAY_PUBLIC_KEY = process.env.KKIAPAY_PUBLIC_KEY?.trim() || '';
export let KKIAPAY_PRIVATE_KEY = process.env.KKIAPAY_PRIVATE_KEY?.trim() || '';
export let KKIAPAY_SECRET_KEY = process.env.KKIAPAY_SECRET_KEY?.trim() || '';
export let KKIAPAY_WEBHOOK_SECRET = process.env.KKIAPAY_WEBHOOK_SECRET?.trim() || '';

export function initKkiapayConfig(config: {
  publicKey?: string;
  privateKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  env?: 'sandbox' | 'live';
}) {
  KKIAPAY_PUBLIC_KEY = config.publicKey?.trim() || '';
  KKIAPAY_PRIVATE_KEY = config.privateKey?.trim() || '';
  KKIAPAY_SECRET_KEY = config.secretKey?.trim() || '';
  KKIAPAY_WEBHOOK_SECRET = config.webhookSecret?.trim() || '';
  KKIAPAY_ENV = config.env || 'sandbox';
  KKIAPAY_API_BASE = KKIAPAY_ENV === 'live'
    ? 'https://api.kkiapay.me'
    : 'https://api-sandbox.kkiapay.me';
}

export function kkiapayConfigured(): boolean {
  return Boolean(KKIAPAY_PUBLIC_KEY && KKIAPAY_PRIVATE_KEY && KKIAPAY_SECRET_KEY);
}

function getApiHeaders() {
  return {
    'Content-Type': 'application/json',
    'x-api-key': KKIAPAY_PUBLIC_KEY,
    'x-secret-key': KKIAPAY_SECRET_KEY,
    'x-private-key': KKIAPAY_PRIVATE_KEY,
  };
}

export interface KkiapayTransactionStatus {
  transactionId: string;
  status: string;
  amount: number;
  fees?: number;
  reason?: string;
  partnerId?: string;
  source?: string;
  failureCode?: string;
  failureMessage?: string;
  isPaymentSucces?: boolean;
  event?: string;
  [key: string]: unknown;
}

export async function verifyKkiapayTransaction(transactionId: string): Promise<KkiapayTransactionStatus> {
  if (!kkiapayConfigured()) {
    throw new Error('Clés API Kkiapay non configurées');
  }
  const id = String(transactionId || '').trim();
  if (!id) {
    throw new Error('Identifiant de transaction Kkiapay manquant');
  }

  const res = await fetch(`${KKIAPAY_API_BASE}/api/v1/transactions/status`, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify({ transactionId: id }),
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    const reason = (body as { reason?: string })?.reason || text || `HTTP ${res.status}`;
    throw new Error(`Kkiapay API ${res.status} : ${reason}`);
  }

  return (body || {}) as KkiapayTransactionStatus;
}

export function verifyKkiapayWebhookSecret(signature: string | null): boolean {
  if (!KKIAPAY_WEBHOOK_SECRET) return false;
  if (!signature) return false;
  try {
    const expected = Buffer.from(KKIAPAY_WEBHOOK_SECRET);
    const received = Buffer.from(String(signature));
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}
