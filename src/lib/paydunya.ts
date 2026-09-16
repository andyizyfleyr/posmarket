import crypto from 'node:crypto';

export const PAYDUNYA_ENV = process.env.PAYDUNYA_ENV === 'live' ? 'live' : 'sandbox';
export const PAYDUNYA_BASE_URL =
  PAYDUNYA_ENV === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';

const PAYDUNYA_MASTER_KEY = process.env.PAYDUNYA_MASTER_KEY?.trim() || '';
const PAYDUNYA_PRIVATE_KEY = process.env.PAYDUNYA_PRIVATE_KEY?.trim() || '';
const PAYDUNYA_TOKEN = process.env.PAYDUNYA_TOKEN?.trim() || '';

export function paydunyaConfigured() {
  return Boolean(PAYDUNYA_MASTER_KEY && PAYDUNYA_PRIVATE_KEY && PAYDUNYA_TOKEN);
}

async function paydunyaFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  if (!paydunyaConfigured()) {
    throw new Error('Clés API PayDunya non configurées');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'PAYDUNYA-MASTER-KEY': PAYDUNYA_MASTER_KEY,
    'PAYDUNYA-PRIVATE-KEY': PAYDUNYA_PRIVATE_KEY,
    'PAYDUNYA-TOKEN': PAYDUNYA_TOKEN,
    ...(init.headers as Record<string, string> | undefined),
  };
  const res = await fetch(`${PAYDUNYA_BASE_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok || body?.response_code !== '00') {
    const detail = body?.response_text || body?.description || text;
    throw new Error(`PayDunya API ${res.status} ${path}: ${detail}`);
  }
  return body as T;
}

export interface PayDunyaCustomer {
  name?: string;
  email?: string;
  phone?: string;
}

export interface PayDunyaInvoiceItem {
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  description?: string;
}

export interface PayDunyaCreateParams {
  description: string;
  totalAmount: number;
  customer?: PayDunyaCustomer;
  items?: PayDunyaInvoiceItem[];
  customData?: Record<string, unknown>;
  returnUrl?: string;
  cancelUrl?: string;
  callbackUrl?: string;
}

export interface PayDunyaCreateResult {
  token: string;
  paymentUrl: string;
}

export async function createPayDunyaInvoice(params: PayDunyaCreateParams): Promise<PayDunyaCreateResult> {
  const items: Record<string, unknown> = {};
  if (params.items) {
    params.items.forEach((item, index) => {
      items[`item_${index}`] = item;
    });
  }

  const body = {
    invoice: {
      items,
      customer: params.customer || {},
      total_amount: params.totalAmount,
      description: params.description,
    },
    store: { name: 'PosMarket' },
    custom_data: params.customData || {},
    actions: {
      cancel_url: params.cancelUrl || '',
      return_url: params.returnUrl || '',
      callback_url: params.callbackUrl || '',
    },
  };

  const res = await paydunyaFetch<{ token?: unknown; response_text?: unknown }>(
    '/checkout-invoice/create',
    { method: 'POST', body: JSON.stringify(body) }
  );

  const token = String(res.token || '');
  const paymentUrl = String(res.response_text || '');
  if (!token || !paymentUrl.startsWith('http')) {
    throw new Error(`Réponse PayDunya invalide: token=${token}`);
  }
  return { token, paymentUrl };
}

export interface PayDunyaInvoiceStatus {
  token: string;
  status: string;
  hash: string;
  mode?: string;
  fail_reason?: string;
  custom_data?: Record<string, unknown>;
  invoice?: { token?: string };
}

export async function getPayDunyaInvoiceStatus(token: string): Promise<PayDunyaInvoiceStatus> {
  const res = await paydunyaFetch<PayDunyaInvoiceStatus>(
    `/checkout-invoice/confirm/${encodeURIComponent(token)}`,
    { method: 'GET' }
  );
  const invoiceToken = String(res.invoice?.token || res.token || token);
  return { ...res, token: invoiceToken };
}

export function verifyPayDunyaHash(hash: string): boolean {
  if (!PAYDUNYA_MASTER_KEY || !hash) return false;
  const expected = crypto.createHash('sha512').update(PAYDUNYA_MASTER_KEY).digest('hex');
  return (
    expected.length === hash.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash))
  );
}