import crypto from 'node:crypto';

export const FEDAPAY_ENV = process.env.FEDAPAY_ENV === 'live' ? 'live' : 'sandbox';
export const FEDAPAY_BASE_URL =
  FEDAPAY_ENV === 'live'
    ? 'https://api.fedapay.com/v1'
    : 'https://sandbox-api.fedapay.com/v1';
const FEDAPAY_SECRET_KEY = process.env.FEDAPAY_SECRET_KEY || '';
const FEDAPAY_WEBHOOK_SECRET = process.env.FEDAPAY_WEBHOOK_SECRET || '';

export function fedapayConfigured() {
  return Boolean(FEDAPAY_SECRET_KEY) && FEDAPAY_ENV;
}

export function webhookConfigured() {
  return Boolean(FEDAPAY_WEBHOOK_SECRET);
}

async function fedapayFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  if (!FEDAPAY_SECRET_KEY) {
    throw new Error('FEDAPAY_SECRET_KEY non configurée');
  }
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${FEDAPAY_SECRET_KEY}`,
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${FEDAPAY_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = body?.message || body?.error?.message || text;
    throw new Error(`FedaPay API ${res.status} ${path}: ${detail}`);
  }
  return body as T;
}

export interface FedaPayTransaction {
  id: string;
  reference: string;
  status?: string;
  custom_metadata?: Record<string, string>;
  [k: string]: unknown;
}

export interface FedaPayCreateParams {
  description: string;
  amount: number;
  currency?: string;
  callbackUrl?: string;
  metadata?: Record<string, string>;
  customer?: { firstname?: string; lastname?: string; email?: string; phone_number?: string };
}

export interface FedaPayCreateResult {
  transactionId: string;
  reference: string;
  paymentUrl?: string;
}

export async function createFedaPayTransaction(
  params: FedaPayCreateParams
): Promise<FedaPayCreateResult> {
  const body = {
    description: params.description,
    amount: params.amount,
    currency: { iso: params.currency || 'XOF' },
    callback_url: params.callbackUrl,
    custom_metadata: params.metadata || {},
    customer: params.customer || {},
  };
  const created = await fedapayFetch<{ transaction?: FedaPayTransaction } & FedaPayTransaction>(
    '/transactions',
    { method: 'POST', body: JSON.stringify(body) }
  );
  const tx = (created.transaction || created) as FedaPayTransaction;
  const transactionId = String(tx.id);
  const reference = String(tx.reference || '');

  let paymentUrl: string | undefined;
  try {
    const tokenData = await fedapayFetch<Record<string, unknown>>(
      `/transactions/${transactionId}/token`,
      { method: 'POST' }
    );
    const directUrl = typeof tokenData.url === 'string' ? tokenData.url : undefined;
    const token = typeof tokenData.token === 'string'
      ? tokenData.token
      : (tokenData.token as { url?: string } | undefined)?.url;
    const url = directUrl || token;
    if (url && typeof url === 'string' && url.startsWith('http')) paymentUrl = url;
  } catch (error) {
    console.error('Failed to request FedaPay payment token:', error);
  }

  return { transactionId, reference, paymentUrl };
}

function sigMatches(expected: string, provided: string): boolean {
  const exp = Buffer.from(expected);
  const prov = Buffer.from(provided);
  return exp.length === prov.length && crypto.timingSafeEqual(exp, prov);
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret = FEDAPAY_WEBHOOK_SECRET
): boolean {
  if (!secret || !signatureHeader) return false;

  const candidates: string[] = [];
  const sig = signatureHeader.trim();

  const pairs: Record<string, string> = {};
  for (const part of sig.split(',')) {
    const eq = part.indexOf('=');
    if (eq > 0) pairs[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
  }

  const timestamp = pairs.t;
  const v1 = pairs.v1 || pairs.sig || sig;

  if (timestamp) {
    candidates.push(
      crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
    );
    try {
      const parsed = parseInt(timestamp, 10);
      if (Number.isFinite(parsed) && Math.abs(Date.now() / 1000 - parsed) > 300) {
        candidates.length = 0;
        candidates.push('stale');
      }
    } catch {
      /* ignore */
    }
  }

  candidates.push(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'));
  candidates.push(crypto.createHmac('sha1', secret).update(rawBody).digest('hex'));

  return candidates.includes('stale')
    ? false
    : candidates.some((c) => c === v1 || (v1 && sigMatches(c, v1)));
}