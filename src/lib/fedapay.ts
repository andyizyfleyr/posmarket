export const FEDAPAY_ENV = 'sandbox'; // temporaire, sera remplacé par la config admin
export const FEDAPAY_API_BASE = FEDAPAY_ENV === 'live'
  ? 'https://api.fedapay.com/v1'
  : 'https://sandbox-api.fedapay.com/v1';

// Ces valeurs seront chargées depuis system_settings en admin
export let FEDAPAY_PUBLIC_KEY = '';
export let FEDAPAY_SECRET_KEY = '';
export let FEDAPAY_ENV_VALUE: 'sandbox' | 'live' = 'sandbox';

export function initFedapayConfig(config: {
  publicKey?: string;
  secretKey?: string;
  env?: 'sandbox' | 'live';
}) {
  FEDAPAY_PUBLIC_KEY = config.publicKey?.trim() || '';
  FEDAPAY_SECRET_KEY = config.secretKey?.trim() || '';
  FEDAPAY_ENV_VALUE = config.env || 'sandbox';
  const apiBase = FEDAPAY_ENV_VALUE === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
  // On met aussi à jour la constante si possible (bien que c'est une constante, on ne peut pas la réassigner)
  // Mais verifyFedapayTransaction utilise FEDAPAY_ENV_VALUE directement.
}

export function fedapayConfigured(): boolean {
  return Boolean(FEDAPAY_PUBLIC_KEY && FEDAPAY_SECRET_KEY);
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

  const res = await fetch(`${FEDAPAY_ENV_VALUE === 'live' ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1'}/transactions/${id}`, {
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

  return (body || {}) as FedapayTransactionStatus;
}
