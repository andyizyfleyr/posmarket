import { createHmac, timingSafeEqual } from 'node:crypto';

const API_BASE = 'https://api.saspay.me/api/v1';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isSaspayId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function saspayConfigured(apiKey: string): boolean {
  return /^sk_(test|live)_\S+$/.test(apiKey.trim());
}

// Seules ces erreurs volontairement publiques peuvent être affichées au client.
export class SaspayPublicError extends Error {}

export function publicSaspayError(error: unknown): string {
  return error instanceof SaspayPublicError ? error.message : 'Le paiement SasPay est momentanément indisponible. Veuillez réessayer plus tard.';
}

export class SaspayApiError extends SaspayPublicError {
  readonly status: number;

  constructor(status: number) {
    const message = status === 401
      ? 'La clé API SasPay est invalide ou expirée. Contactez l’administrateur.'
      : status === 403
        ? 'Le compte SasPay ne peut pas effectuer cet encaissement. Contactez l’administrateur.'
        : status === 400 || status === 422
          ? 'SasPay ne peut pas traiter cette demande. Vérifiez vos informations ou contactez le support.'
          : status === 429
            ? 'SasPay reçoit trop de demandes. Veuillez patienter avant de réessayer.'
            : 'Le service SasPay est momentanément indisponible. Veuillez réessayer plus tard.';
    super(message);
    this.name = 'SaspayApiError';
    this.status = status;
  }
}

type JsonObject = Record<string, unknown>;

async function saspayRequest(apiKey: string, path: string, body?: JsonObject): Promise<JsonObject> {
  if (!saspayConfigured(apiKey)) throw new SaspayApiError(401);
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store',
      redirect: 'error',
      // La vérification peut attendre le réseau mobile-money en amont.
      signal: AbortSignal.timeout(body || path.includes('/verify/') ? 10_000 : 5_000),
    });
  } catch {
    // Ne jamais journaliser la requête, ses en-têtes ou la clé. Le checkout
    // n'est pas idempotent : ne pas réessayer automatiquement un POST.
    throw new SaspayApiError(0);
  }

  const envelope: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new SaspayApiError(response.status);
  if (!envelope || typeof envelope !== 'object') throw new SaspayApiError(0);
  const result = envelope as JsonObject;
  if (result.success !== true || !result.data || typeof result.data !== 'object' || Array.isArray(result.data)) {
    throw new SaspayApiError(typeof result.code === 'number' ? result.code : 0);
  }
  return result.data as JsonObject;
}

/** URL publique de l'application : jamais construite depuis un en-tête client. */
export function saspayAppOrigin(): string {
  const configured = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new SaspayPublicError('Configurez APP_URL avec l’URL publique HTTPS de PosMarket.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new SaspayPublicError('Configurez APP_URL avec l’URL publique HTTPS de PosMarket, sans chemin.');
  }
  return url.origin;
}

export function saspayReturnUrl(transactionId: string): string {
  if (!isSaspayId(transactionId)) throw new SaspayPublicError('Facture SasPay invalide.');
  const url = new URL(saspayAppOrigin());
  url.pathname = '/subscription';
  url.searchParams.set('saspay', 'return');
  url.searchParams.set('payment', transactionId);
  return url.toString();
}

export interface SaspayCheckoutInput {
  amount: number;
  transactionId: string;
  tier: string;
  duration: string;
  customerEmail: string;
  customerName: string;
  returnUrl: string;
}

export async function createSaspayCheckout(apiKey: string, input: SaspayCheckoutInput) {
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || !isSaspayId(input.transactionId)) {
    throw new SaspayPublicError('Montant ou facture SasPay invalide.');
  }
  const data = await saspayRequest(apiKey, '/checkout-sessions/', {
    // Les prix PosMarket sont entiers en XOF ; l'API exige une chaîne décimale.
    amount: `${input.amount}.00`,
    currency: 'XOF',
    description: `Abonnement ${input.tier} - ${input.duration}`,
    customer_email: input.customerEmail,
    customer_name: input.customerName,
    return_url: input.returnUrl,
    metadata: { posmarket_payment_id: input.transactionId },
  });
  const checkoutUrl = typeof data.checkout_url === 'string' ? data.checkout_url : '';
  let url: URL;
  try {
    url = new URL(checkoutUrl);
  } catch {
    throw new SaspayApiError(0);
  }
  if (!isSaspayId(data.id) || url.protocol !== 'https:' || url.hostname !== 'pay.saspay.me' || url.port || url.username || url.password) {
    throw new SaspayApiError(0);
  }
  return { id: data.id, checkoutUrl: url.toString() };
}

export interface SaspayCheckoutStatus {
  id: string;
  status: string;
  transaction_id: string | null;
  transaction_status?: string | null;
}

export async function getSaspayCheckoutStatus(apiKey: string, sessionId: string): Promise<SaspayCheckoutStatus> {
  if (!isSaspayId(sessionId)) throw new SaspayPublicError('Session SasPay invalide.');
  const data = await saspayRequest(apiKey, `/checkout-sessions/${encodeURIComponent(sessionId)}/status/`);
  if (data.id !== sessionId || typeof data.status !== 'string') throw new SaspayApiError(0);
  return {
    id: sessionId,
    status: data.status,
    transaction_id: isSaspayId(data.transaction_id) ? data.transaction_id : null,
    transaction_status: typeof data.transaction_status === 'string' ? data.transaction_status : null,
  };
}

export interface SaspayPayment {
  id: string;
  status: string;
  requested_amount: string;
  currency: string;
  flow_direction?: string;
  transaction_type?: string;
  debited_amount?: string;
  net_amount?: string;
  fee_charge_mode?: string;
}

export async function verifySaspayPayment(apiKey: string, paymentId: string): Promise<SaspayPayment> {
  if (!isSaspayId(paymentId)) throw new SaspayPublicError('Transaction SasPay invalide.');
  const data = await saspayRequest(apiKey, `/payments/${encodeURIComponent(paymentId)}/verify/`);
  if (data.id !== paymentId || typeof data.status !== 'string') throw new SaspayApiError(0);
  return data as unknown as SaspayPayment;
}

/** Nombre décimal normalisé, sans conversion flottante ni arrondi. */
export function normalizeSaspayAmount(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const whole = match[1].replace(/^0+(?=\d)/, '');
  return `${whole}.${(match[2] || '').padEnd(2, '0')}`;
}

/** L'URL de retour et l'événement seul ne constituent jamais une preuve. */
export function saspayPaymentMatches(
  session: SaspayCheckoutStatus,
  payment: SaspayPayment,
  expected: { sessionId: string; amount: number; currency: string; paymentId?: string },
): boolean {
  if (!Number.isSafeInteger(expected.amount) || expected.amount <= 0) return false;
  return session.id === expected.sessionId && session.status === 'PAID' &&
    (!session.transaction_status || session.transaction_status === 'SUCCESS') &&
    isSaspayId(session.transaction_id) && payment.id === session.transaction_id &&
    (!expected.paymentId || expected.paymentId === payment.id) && payment.status === 'SUCCESS' &&
    (!payment.flow_direction || payment.flow_direction === 'INBOUND') &&
    (!payment.transaction_type || payment.transaction_type === 'PAIEMENT') &&
    payment.currency === expected.currency &&
    normalizeSaspayAmount(payment.requested_amount) === `${expected.amount}.00`;
}

/** Les webhooks ne contiennent pas l'identifiant du checkout ; on cherche dans les sessions payées. */
export async function findSaspayCheckoutForPayment(apiKey: string, paymentId: string): Promise<{ id: string; localTransactionId?: string } | null> {
  if (!isSaspayId(paymentId)) return null;
  // Recherche rapide sur les sessions récentes. Le cron et le retour client
  // revérifient toutes les factures locales si la session n'est pas ici.
  const data = await saspayRequest(apiKey, '/checkout-sessions/?status=PAID&page=1&page_size=100');
  if (!Array.isArray(data.results)) throw new SaspayApiError(0);
  for (const item of data.results) {
    if (!item || typeof item !== 'object') continue;
    const session = item as JsonObject;
    if (session.transaction === paymentId && isSaspayId(session.id)) {
      const metadata = session.metadata;
      const localTransactionId = metadata && typeof metadata === 'object'
        ? (metadata as JsonObject).posmarket_payment_id : undefined;
      // Retrouve la facture même si la sauvegarde de l'id de session a échoué.
      return { id: session.id, localTransactionId: isSaspayId(localTransactionId) ? localTransactionId : undefined };
    }
  }
  return null;
}

/** HMAC de l'horodatage et des octets reçus, avec protection anti-rejeu. */
export function verifySaspayWebhookSignature(
  rawBody: Uint8Array,
  signature: string | null,
  timestamp: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!secret || !signature || !/^[a-f0-9]{64}$/.test(signature) || !timestamp || !/^\d{1,12}$/.test(timestamp)) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(nowSeconds - seconds) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  const received = Buffer.from(signature, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}
