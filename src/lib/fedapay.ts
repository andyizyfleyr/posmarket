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
  reference?: string;
  status?: string;
  custom_metadata?: Record<string, string>;
  payment_url?: string;
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
  const created = await fedapayFetch<
    { 'v1/transaction'?: FedaPayTransaction } & { transaction?: FedaPayTransaction } & FedaPayTransaction
  >(
    '/transactions',
    { method: 'POST', body: JSON.stringify(body) }
  );
  const tx = (created['v1/transaction'] || created.transaction || created) as FedaPayTransaction;
  const transactionId = String(tx.id);
  const reference = String(tx.reference || '');

  let paymentUrl: string | undefined;
  if (typeof tx.payment_url === 'string' && tx.payment_url.startsWith('http')) {
    paymentUrl = tx.payment_url;
  } else {
    try {
      const tokenData = await fedapayFetch<{ url?: unknown; token?: unknown }>(
        `/transactions/${transactionId}/token`,
        { method: 'POST' }
      );
      const url = tokenData.url;
      if (typeof url === 'string' && url.startsWith('http')) paymentUrl = url;
    } catch (error) {
      console.error('Failed to request FedaPay payment token:', error);
    }
  }

  return { transactionId, reference, paymentUrl };
}

export async function getFedaPayTransaction(id: string): Promise<FedaPayTransaction> {
  const res = await fedapayFetch<
    { 'v1/transaction'?: FedaPayTransaction } & { transaction?: FedaPayTransaction } & FedaPayTransaction
  >(`/transactions/${id}`, { method: 'GET' });
  return (res['v1/transaction'] || res.transaction || res) as FedaPayTransaction;
}

function sigMatches(expected: string, provided: string): boolean {
  return expected.length === provided.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret = FEDAPAY_WEBHOOK_SECRET
): boolean {
  if (!secret || !signatureHeader) return false;

  let timestamp: number | null = null;
  const signatures: string[] = [];

  for (const part of signatureHeader.trim().split(',')) {
    const eq = part.indexOf('=');
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === 't') {
      const parsed = parseInt(value, 10);
      if (Number.isFinite(parsed)) timestamp = parsed;
    } else if (key === 's' || key === 'v1' || key === 'sig') {
      signatures.push(value);
    }
  }
  if (signatures.length === 0) signatures.push(signatureHeader.trim());

  const expected: string[] = [];
  if (timestamp !== null) {
    expected.push(crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex'));
  }
  expected.push(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'));
  expected.push(crypto.createHmac('sha1', secret).update(rawBody).digest('hex'));

  return signatures.some((provided) => expected.some((e) => sigMatches(e, provided)));
}