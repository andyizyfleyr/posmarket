import crypto from 'node:crypto';

export const FEEXPAY_ENV: 'sandbox' | 'live' = 'sandbox';
export let FEEXPAY_API_BASE = 'https://api-sandbox-v2.feexpay.me';

export let FEEXPAY_SHOP_ID = '';
export let FEEXPAY_API_KEY = '';
export let FEEXPAY_SECRET_KEY = '';
export let FEEXPAY_WEBHOOK_SECRET = '';

export function initFeexpayConfig(config: {
  shopId?: string;
  apiKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  env?: 'sandbox' | 'live';
}) {
  FEEXPAY_SHOP_ID = config.shopId?.trim() || '';
  FEEXPAY_API_KEY = config.apiKey?.trim() || '';
  FEEXPAY_SECRET_KEY = config.secretKey?.trim() || '';
  FEEXPAY_WEBHOOK_SECRET = config.webhookSecret?.trim() || '';
  FEEXPAY_API_BASE = FEEXPAY_ENV === 'live' ? 'https://api-v2.feexpay.me' : 'https://api-sandbox-v2.feexpay.me';
}

export function feexpayConfigured(): boolean {
  return Boolean(FEEXPAY_SHOP_ID && FEEXPAY_API_KEY);
}

export function verifyFeexpayWebhookSignature(payloadRaw: string, signatureHeader: string | null): boolean {
  if (!FEEXPAY_WEBHOOK_SECRET) return false;
  if (!signatureHeader) return false;
  try {
    const hmac = crypto.createHmac('sha256', FEEXPAY_WEBHOOK_SECRET).update(payloadRaw).digest('hex');
    const expected = Buffer.from(hmac);
    const received = Buffer.from(String(signatureHeader));
    if (expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export interface FeexpayTransactionStatus {
  transactionId?: string;
  reference?: string;
  status: string;
  amount: number;
  currency?: string;
  partnerId?: string;
  [key: string]: unknown;
}

export async function verifyFeexpayTransaction(transactionId: string): Promise<FeexpayTransactionStatus> {
  if (!feexpayConfigured()) {
    throw new Error('Clés API FeexPay non configurées');
  }
  const id = String(transactionId || '').trim();
  if (!id) {
    throw new Error('Identifiant de transaction FeexPay manquant');
  }

  const res = await fetch(`${FEEXPAY_API_BASE}/transactions/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': FEEXPAY_API_KEY,
      ...(FEEXPAY_SECRET_KEY ? { 'X-SECRET-KEY': FEEXPAY_SECRET_KEY } : {}),
      ...(FEEXPAY_SHOP_ID ? { 'X-SHOP-ID': FEEXPAY_SHOP_ID } : {}),
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const reason = (body as { message?: string; reason?: string })?.message || (body as { message?: string; reason?: string })?.reason || text || `HTTP ${res.status}`;
    throw new Error(`FeexPay API ${res.status} : ${reason}`);
  }

  const raw = (body as Record<string, unknown>) || {};
  const txObj = (raw['transaction'] || raw['data'] || raw) as Record<string, unknown>;
  const status = String(txObj?.status || raw?.status || '').toLowerCase();

  return {
    transactionId: String(txObj?.transactionId || txObj?.reference || id),
    reference: String(txObj?.reference || txObj?.externalId || id),
    status,
    amount: Number(txObj?.amount ?? raw?.amount ?? 0),
    currency: String(txObj?.currency || raw?.currency || 'XOF'),
    partnerId: String(txObj?.partnerId || txObj?.callbackInfo || txObj?.orderId || ''),
    ...(txObj),
  } as FeexpayTransactionStatus;
}