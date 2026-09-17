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

async function paydunyaRawFetch<T = { [k: string]: unknown }>(path: string, init: RequestInit = {}): Promise<T> {
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
  let body: unknown = {};
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (!res.ok) {
        throw new Error(`PayDunya API HTTP ${res.status} ${path}: Service indisponible ou endpoint non trouvé.`);
      }
      throw new Error(`Réponse PayDunya non-JSON (HTTP ${res.status}).`);
    }
  }
  if (!res.ok) {
    const detail = (body as { response_text?: unknown }).response_text || text;
    throw new Error(`PayDunya API ${res.status} ${path}: ${detail}`);
  }
  return body as T;
}

async function paydunyaFetch<T = { [k: string]: unknown }>(path: string, init: RequestInit = {}): Promise<T> {
  const body = await paydunyaRawFetch<T>(path, init);
  if ((body as { response_code?: unknown }).response_code !== '00') {
    throw new Error(
      `PayDunya API ${path}: ${(body as { response_text?: unknown }).response_text || 'code non 00'}`,
    );
  }
  return body;
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
  callbackUrl?: string;
}

export interface PayDunyaCreateResult {
  token: string;
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
      callback_url: params.callbackUrl || '',
    },
  };

  const res = await paydunyaFetch<{ token?: unknown }>('/checkout-invoice/create', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const token = String(res.token || '');
  if (!token) {
    throw new Error(`Réponse PayDunya invalide: token=${token}`);
  }
  return { token };
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

// --- SoftPay (Paiement Sans Redirection) ---

export type SoftPayOperator = 'mtn-benin' | 'moov-benin' | 'celtiis-cash';

export const SOFT_PAY_OPERATORS: Array<{
  key: SoftPayOperator;
  label: string;
  hint: string;
}> = [
  { key: 'mtn-benin', label: 'MTN MoMo', hint: 'Bénin' },
  { key: 'moov-benin', label: 'Moov Money', hint: 'Bénin' },
  { key: 'celtiis-cash', label: 'Celtiis Cash', hint: 'Bénin' },
];

export interface SoftPayCustomer {
  fullName?: string;
  email?: string;
  phone: string;
}

export interface SoftPayResult {
  success: boolean;
  message: string;
  pending: boolean;
}

function buildOperatorPayload(
  operator: SoftPayOperator,
  token: string,
  customer: SoftPayCustomer,
): Record<string, unknown> {
  switch (operator) {
    case 'mtn-benin':
      return {
        mtn_benin_customer_fullname: customer.fullName || '',
        mtn_benin_email: customer.email || '',
        mtn_benin_phone_number: customer.phone,
        mtn_benin_wallet_provider: 'MTNBENIN',
        payment_token: token,
      };
    case 'moov-benin':
      return {
        moov_benin_customer_fullname: customer.fullName || '',
        moov_benin_email: customer.email || '',
        moov_benin_phone_number: customer.phone,
        payment_token: token,
      };
    case 'celtiis-cash':
      return {
        celtiis_cash_customer_fullname: customer.fullName || '',
        celtiis_cash_customer_email: customer.email || '',
        celtiis_cash_phone_number: customer.phone,
        payment_token: token,
      };
  }
}

const PENDING_HINTS = ['en cours', 'sms', 'réception', 'attente'];

function isPendingMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return PENDING_HINTS.some((h) => lower.includes(h));
}

export async function chargePayDunyaSoftPay(params: {
  token: string;
  operator: SoftPayOperator;
  customer: SoftPayCustomer;
  sandboxPassword?: string;
}): Promise<SoftPayResult> {
  const isSandbox = PAYDUNYA_ENV === 'sandbox';

  let path: string;
  let body: Record<string, unknown>;

  if (isSandbox) {
    path = '/softpay/checkout/make-payment';
    body = {
      phone_phone: params.customer.phone,
      customer_email: params.customer.email || '',
      password: params.sandboxPassword || '',
      invoice_token: params.token,
    };
  } else {
    path = `/softpay/${params.operator}`;
    body = buildOperatorPayload(params.operator, params.token, params.customer);
  }

  try {
    const res = await paydunyaRawFetch<{
      success?: unknown;
      message?: unknown;
      url?: unknown;
      data?: unknown;
    }>(path, { method: 'POST', body: JSON.stringify(body) });

    const success = Boolean(res.success);
    const message = String(res.message || 'Paiement traité par PayDunya.');
    const pending = isSandbox ? false : isPendingMessage(message);

    return { success, message, pending };
  } catch (err) {
    if (isSandbox) {
      return {
        success: false,
        message:
          'L\'API SoftPay Sandbox de PayDunya est indisponible (HTTP 404 sur les serveurs PayDunya). Utilisez le guichet Sandbox ci-dessous pour régler la facture de test.',
        pending: false,
      };
    }
    throw err;
  }
}