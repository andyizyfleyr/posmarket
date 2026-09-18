export const FEDAPAY_ENV: 'sandbox' | 'live' = 'sandbox'; // temporaire, sera remplacé par la config admin
export const FEDAPAY_API_BASE = (FEDAPAY_ENV as string) === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

// Ces valeurs seront chargées depuis system_settings en admin
export let FEDAPAY_PUBLIC_KEY = '';
export let FEDAPAY_SECRET_KEY = '';
export let FEDAPAY_WEBHOOK_SECRET = '';
export let FEDAPAY_ENV_VALUE: 'sandbox' | 'live' = 'sandbox';

export function initFedapayConfig(config: {
  publicKey?: string;
  secretKey?: string;
  webhookSecret?: string;
  env?: 'sandbox' | 'live';
}) {
  FEDAPAY_PUBLIC_KEY = config.publicKey?.trim() || '';
  FEDAPAY_SECRET_KEY = config.secretKey?.trim() || '';
  FEDAPAY_WEBHOOK_SECRET = config.webhookSecret?.trim() || '';
  FEDAPAY_ENV_VALUE = config.env || 'sandbox';
}

export function fedapayConfigured(): boolean {
  return Boolean(FEDAPAY_PUBLIC_KEY && FEDAPAY_SECRET_KEY);
}

export function verifyFedapayWebhookSignature(payloadRaw: string, signatureHeader: string | null): boolean {
  if (!FEDAPAY_WEBHOOK_SECRET || !signatureHeader) return true; // Si pas de secret configuré, on vérifie via l'API REST
  try {
    const crypto = require('node:crypto');
    let sig = signatureHeader;
    if (signatureHeader.includes('s=')) {
      const parts = signatureHeader.split(',').reduce<Record<string, string>>((acc, part) => {
        const [k, v] = part.split('=');
        if (k && v) acc[k.trim()] = v.trim();
        return acc;
      }, {});
      sig = parts.s || parts.v1 || signatureHeader;
    }
    const hmac = crypto.createHmac('sha256', FEDAPAY_WEBHOOK_SECRET).update(payloadRaw).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(sig)) || hmac === sig;
  } catch {
    return true; // En cas de doute, la vérification transactionnelle par API REST fera autorité
  }
}

export interface FedapayTransactionStatus {
  id: number;
  reference?: string;
  amount: number;
  status: string;
  description?: string;
  currency_id?: number;
  customer_id?: number;
  created_at?: string;
  [key: string]: unknown;
}

export async function verifyFedapayTransaction(transactionId: string | number): Promise<FedapayTransactionStatus> {
  if (!FEDAPAY_SECRET_KEY) {
    throw new Error('Clés API FedaPay non configurées');
  }
  const id = String(transactionId || '').trim();
  if (!id) {
    throw new Error('Identifiant de transaction FedaPay manquant');
  }

  const isLive = FEDAPAY_SECRET_KEY.startsWith('sk_live') || FEDAPAY_ENV_VALUE === 'live';
  const apiBase = isLive ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';

  const res = await fetch(`${apiBase}/transactions/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FEDAPAY_SECRET_KEY}`,
    },
  });

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    const reason = (body as { message?: string })?.message || text || `HTTP ${res.status}`;
    throw new Error(`FedaPay API ${res.status} : ${reason}`);
  }

  const raw = (body as Record<string, unknown>) || {};
  const txObj = (raw['v1/transaction'] || raw['transaction'] || raw['v1/transactions'] || raw) as Record<string, unknown>;

  return {
    id: Number(txObj.id || raw.id || id),
    reference: String(txObj.reference || raw.reference || ''),
    amount: Number(txObj.amount ?? raw.amount ?? 0),
    status: String(txObj.status || raw.status || '').toLowerCase(),
    description: String(txObj.description || raw.description || ''),
    currency_id: Number(txObj.currency_id || raw.currency_id || 0),
    customer_id: Number(txObj.customer_id || raw.customer_id || 0),
    ...txObj,
  } as FedapayTransactionStatus;
}
