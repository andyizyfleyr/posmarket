import { randomBytes } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  orderPayments,
  orders,
  storePaymentCredentials,
  storePaymentMethods,
} from '@/db/schema';
import { decryptPaymentSecret, encryptPaymentSecret } from '@/lib/payment-secrets';
import { publicSaspayError } from '@/lib/saspay';

/**
 * Moyens de paiement par boutique.
 *
 * Ce module est strictement serveur : il déchiffre les secrets des vendeurs et
 * appelle les API des fournisseurs. Les seules données renvoyées au navigateur
 * sont les clés publiques, le code USSD et les instructions d'encaissement.
 */

export type StorePaymentProvider = 'cod' | 'kkiapay' | 'fedapay' | 'saspay' | 'ussd';

export const STORE_PAYMENT_PROVIDERS: StorePaymentProvider[] = [
  'cod',
  'kkiapay',
  'fedapay',
  'saspay',
  'ussd',
];

export const STORE_PAYMENT_LABELS: Record<StorePaymentProvider, string> = {
  cod: 'Paiement à la livraison',
  kkiapay: 'Kkiapay (Mobile Money / carte)',
  fedapay: 'FedaPay (Mobile Money / carte)',
  saspay: 'SasPay (Mobile Money)',
  ussd: 'Paiement USSD',
};

const ONLINE_PROVIDERS = new Set<StorePaymentProvider>(['kkiapay', 'fedapay', 'saspay']);

export type PublicStorePaymentConfig = {
  instructions?: string;
  ussdCode?: string;
  publicKey?: string;
  env?: 'sandbox' | 'live';
};

export type StorePaymentSecretPayload = {
  privateKey?: string;
  secretKey?: string;
  apiKey?: string;
  webhookSecret?: string;
};

export type StorePaymentMethodView = {
  provider: StorePaymentProvider;
  label: string;
  enabled: boolean;
  config: PublicStorePaymentConfig;
  hasSecret: boolean;
  keyHint: string | null;
};

export type CheckoutPaymentMethod = {
  provider: StorePaymentProvider;
  label: string;
  isOnline: boolean;
  config: PublicStorePaymentConfig;
};

const PROVIDER_SET = new Set<string>(STORE_PAYMENT_PROVIDERS);

export function isStorePaymentProvider(value: unknown): value is StorePaymentProvider {
  return typeof value === 'string' && PROVIDER_SET.has(value);
}

export function isOnlineStorePayment(provider: StorePaymentProvider): boolean {
  return ONLINE_PROVIDERS.has(provider);
}

/** Normalise les valeurs historiques (`ESPECES`, `CASH`, `MOBILE_MONEY`…). */
export function normalizeStorePaymentProvider(value: unknown): StorePaymentProvider | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return 'cod';
  if (raw === 'especes' || raw === 'espèces' || raw === 'cash' || raw === 'cod') return 'cod';
  if (raw === 'kkiapay') return 'kkiapay';
  if (raw === 'fedapay') return 'fedapay';
  if (raw === 'saspay') return 'saspay';
  if (raw === 'ussd') return 'ussd';
  return null;
}

/** Méthode de paiement portée sur la commande (compatibilité rapports). */
export function orderPaymentMethodLabel(provider: StorePaymentProvider): string {
  if (provider === 'cod') return 'ESPECES';
  return 'MOBILE_MONEY';
}

export function paymentMethodDisplayLabel(provider: string): string {
  if (isStorePaymentProvider(provider)) return STORE_PAYMENT_LABELS[provider];
  return provider || 'Paiement';
}

function pickPublicConfig(raw: unknown): PublicStorePaymentConfig {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const config: PublicStorePaymentConfig = {};
  const instructions = String(value.instructions || '').trim();
  const ussdCode = String(value.ussdCode || value.ussd_code || '').trim();
  const publicKey = String(value.publicKey || value.public_key || '').trim();
  const env = value.env === 'live' ? 'live' : value.env === 'sandbox' ? 'sandbox' : undefined;
  if (instructions) config.instructions = instructions.slice(0, 500);
  if (ussdCode) config.ussdCode = ussdCode.slice(0, 80);
  if (publicKey) config.publicKey = publicKey.slice(0, 200);
  if (env) config.env = env;
  return config;
}

function pickSecretPayload(raw: unknown): StorePaymentSecretPayload {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const payload: StorePaymentSecretPayload = {};
  for (const key of ['privateKey', 'secretKey', 'apiKey', 'webhookSecret'] as const) {
    const secret = String(value[key] || '').trim();
    if (secret) payload[key] = secret.slice(0, 500);
  }
  return payload;
}

/**
 * Méthodes activées, par boutique. Une boutique sans configuration conserve le
 * paiement à la livraison pour ne jamais casser les commandes existantes.
 */
export async function getEnabledStorePaymentMethods(
  storeIds: string[],
): Promise<Record<string, CheckoutPaymentMethod[]>> {
  const ids = Array.from(new Set(storeIds.filter(Boolean)));
  const result: Record<string, CheckoutPaymentMethod[]> = {};
  if (ids.length === 0) return result;

  const rows = await db
    .select({
      storeId: storePaymentMethods.storeId,
      provider: storePaymentMethods.provider,
      config: storePaymentMethods.config,
    })
    .from(storePaymentMethods)
    .where(and(inArray(storePaymentMethods.storeId, ids), eq(storePaymentMethods.enabled, true)));

  for (const id of ids) result[id] = [];
  for (const row of rows) {
    if (!isStorePaymentProvider(row.provider)) continue;
    result[row.storeId]?.push({
      provider: row.provider,
      label: STORE_PAYMENT_LABELS[row.provider],
      isOnline: isOnlineStorePayment(row.provider),
      config: pickPublicConfig(row.config),
    });
  }

  for (const id of ids) {
    if (result[id].length === 0) {
      result[id] = [
        {
          provider: 'cod',
          label: STORE_PAYMENT_LABELS.cod,
          isOnline: false,
          config: {},
        },
      ];
    }
  }
  return result;
}

export async function listStorePaymentMethods(storeId: string): Promise<StorePaymentMethodView[]> {
  const [methods, credentials] = await Promise.all([
    db.select().from(storePaymentMethods).where(eq(storePaymentMethods.storeId, storeId)),
    db
      .select({
        provider: storePaymentCredentials.provider,
        keyHint: storePaymentCredentials.keyHint,
      })
      .from(storePaymentCredentials)
      .where(eq(storePaymentCredentials.storeId, storeId)),
  ]);

  const methodMap = new Map(methods.map((row) => [row.provider, row]));
  const credentialMap = new Map(credentials.map((row) => [row.provider, row]));

  return STORE_PAYMENT_PROVIDERS.map((provider) => {
    const row = methodMap.get(provider);
    const credential = credentialMap.get(provider);
    return {
      provider,
      label: STORE_PAYMENT_LABELS[provider],
      enabled: row?.enabled ?? false,
      config: pickPublicConfig(row?.config),
      hasSecret: Boolean(credential),
      keyHint: credential?.keyHint || null,
    };
  });
}

export async function loadStorePaymentCredential(
  storeId: string,
  provider: StorePaymentProvider,
): Promise<StorePaymentSecretPayload | null> {
  const [row] = await db
    .select({ payload: storePaymentCredentials.payload })
    .from(storePaymentCredentials)
    .where(
      and(
        eq(storePaymentCredentials.storeId, storeId),
        eq(storePaymentCredentials.provider, provider),
      ),
    )
    .limit(1);
  if (!row?.payload) return null;
  try {
    return decryptPaymentSecret<StorePaymentSecretPayload>(row.payload);
  } catch (error) {
    console.error(`[store-payments] secret illisible (${provider}):`, error);
    return null;
  }
}

function keyHintFor(provider: StorePaymentProvider, payload: StorePaymentSecretPayload): string | null {
  const value = payload.apiKey || payload.secretKey || payload.privateKey || '';
  if (!value) return null;
  if (provider === 'saspay') {
    const match = /^sk_(?:test|live)_(.+)$/.exec(value);
    if (match?.[1]) return `…${match[1].slice(-4)}`;
  }
  return `…${value.slice(-4)}`;
}

export type SaveStorePaymentMethodInput = {
  enabled: boolean;
  config?: PublicStorePaymentConfig;
  secrets?: StorePaymentSecretPayload;
};

export async function saveStorePaymentMethod(
  storeId: string,
  provider: StorePaymentProvider,
  input: SaveStorePaymentMethodInput,
): Promise<{ success: boolean; error?: string }> {
  const enabled = Boolean(input.enabled);
  const config = pickPublicConfig(input.config);
  const nextSecrets = pickSecretPayload(input.secrets);
  const hasNewSecret = Object.keys(nextSecrets).length > 0;
  const existingSecret = await loadStorePaymentCredential(storeId, provider);

  if (enabled) {
    if (provider === 'kkiapay') {
      if (!config.publicKey) return { success: false, error: 'Renseignez la clé publique Kkiapay.' };
      if (!hasNewSecret && !existingSecret?.privateKey) {
        return { success: false, error: 'Renseignez les clés privée et secrète Kkiapay.' };
      }
    }
    if (provider === 'fedapay') {
      if (!config.publicKey) return { success: false, error: 'Renseignez la clé publique FedaPay.' };
      if (!hasNewSecret && !existingSecret?.secretKey) {
        return { success: false, error: 'Renseignez la clé secrète FedaPay.' };
      }
    }
    if (provider === 'saspay') {
      if (!hasNewSecret && !existingSecret?.apiKey) {
        return { success: false, error: 'Renseignez la clé API SasPay.' };
      }
    }
    if (provider === 'ussd' && !config.ussdCode) {
      return { success: false, error: 'Renseignez le code USSD à composer.' };
    }
  }

  await db
    .insert(storePaymentMethods)
    .values({ storeId, provider, enabled, config, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [storePaymentMethods.storeId, storePaymentMethods.provider],
      set: { enabled, config, updatedAt: new Date() },
    });

  if (hasNewSecret) {
    let encrypted: string;
    try {
      encrypted = encryptPaymentSecret(nextSecrets);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chiffrement des clés impossible.',
      };
    }
    await db
      .insert(storePaymentCredentials)
      .values({
        storeId,
        provider,
        payload: encrypted,
        keyHint: keyHintFor(provider, nextSecrets),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [storePaymentCredentials.storeId, storePaymentCredentials.provider],
        set: {
          payload: encrypted,
          keyHint: keyHintFor(provider, nextSecrets),
          updatedAt: new Date(),
        },
      });
  }

  return { success: true };
}

export function createOrderPaymentToken(): string {
  return randomBytes(24).toString('base64url');
}

/**
 * Prépare le paiement côté fournisseur après la création de la commande.
 * Pour Kkiapay/FedaPay, le widget navigateur a seulement besoin de la clé
 * publique : le secret reste sur le serveur pour la vérification.
 */
export async function initializeStorePayment(input: {
  paymentId: string;
  orderId: string;
  storeId: string;
  provider: StorePaymentProvider;
  amount: number;
  customer: { name?: string | null; email?: string | null; phone?: string | null };
}): Promise<{
  ok: boolean;
  publicKey?: string;
  env?: 'sandbox' | 'live';
  checkoutUrl?: string;
  instructions?: string;
  ussdCode?: string;
  error?: string;
}> {
  if (input.provider === 'cod') return { ok: true };
  if (input.provider === 'ussd') {
    const rows = await db
      .select({ config: storePaymentMethods.config })
      .from(storePaymentMethods)
      .where(
        and(
          eq(storePaymentMethods.storeId, input.storeId),
          eq(storePaymentMethods.provider, 'ussd'),
        ),
      )
      .limit(1);
    const config = pickPublicConfig(rows[0]?.config);
    return {
      ok: true,
      ussdCode: config.ussdCode,
      instructions: config.instructions,
    };
  }

  if (input.provider === 'kkiapay' || input.provider === 'fedapay') {
    const [row] = await db
      .select({ config: storePaymentMethods.config })
      .from(storePaymentMethods)
      .where(
        and(
          eq(storePaymentMethods.storeId, input.storeId),
          eq(storePaymentMethods.provider, input.provider),
        ),
      )
      .limit(1);
    const config = pickPublicConfig(row?.config);
    const secrets = await loadStorePaymentCredential(input.storeId, input.provider);
    if (!config.publicKey || !secrets) {
      return { ok: false, error: 'Le paiement en ligne de cette boutique est mal configuré.' };
    }
    const env =
      config.env ||
      (config.publicKey.startsWith('pk_live') ||
      config.publicKey.startsWith('live') ||
      secrets.secretKey?.startsWith('sk_live') ||
      secrets.privateKey?.startsWith('live')
        ? 'live'
        : 'sandbox');
    return { ok: true, publicKey: config.publicKey, env };
  }

  // SasPay : le guichet est hébergé, il faut créer une session côté serveur.
  const secrets = await loadStorePaymentCredential(input.storeId, 'saspay');
  if (!secrets?.apiKey) {
    return { ok: false, error: 'La clé API SasPay de cette boutique est absente.' };
  }
  try {
    const { createSaspayStoreCheckout, saspayStoreReturnUrl } = await import('@/lib/saspay');
    const checkout = await createSaspayStoreCheckout(secrets.apiKey, {
      amount: Math.round(input.amount),
      paymentId: input.paymentId,
      description: `Commande ${input.orderId.slice(0, 8).toUpperCase()}`,
      customerEmail: input.customer.email || 'client@posmarket.com',
      customerName: input.customer.name || 'Client PosMarket',
      returnUrl: saspayStoreReturnUrl(input.paymentId),
    });
    await db
      .update(orderPayments)
      .set({
        checkoutUrl: checkout.checkoutUrl,
        providerCheckoutId: checkout.id,
        updatedAt: new Date(),
      })
      .where(eq(orderPayments.id, input.paymentId));
    return { ok: true, checkoutUrl: checkout.checkoutUrl };
  } catch (error) {
    const message = publicSaspayError(error);
    await db
      .update(orderPayments)
      .set({ status: 'FAILED', failureReason: message.slice(0, 300), updatedAt: new Date() })
      .where(and(eq(orderPayments.id, input.paymentId), eq(orderPayments.status, 'PENDING')));
    return { ok: false, error: message };
  }
}

type KkiapayStatusResponse = {
  status?: string;
  amount?: number;
  partnerId?: string;
  failureMessage?: string;
  reason?: string;
};

async function verifyKkiapayWithCredentials(
  secrets: StorePaymentSecretPayload,
  publicKey: string,
  transactionId: string,
  env: 'sandbox' | 'live',
): Promise<KkiapayStatusResponse> {
  const base = env === 'live' ? 'https://api.kkiapay.me' : 'https://api-sandbox.kkiapay.me';
  const res = await fetch(`${base}/api/v1/transactions/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': publicKey,
      'x-secret-key': secrets.secretKey || '',
      'x-private-key': secrets.privateKey || '',
    },
    body: JSON.stringify({ transactionId }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const reason = (body as { reason?: string })?.reason || `HTTP ${res.status}`;
    throw new Error(`Kkiapay API ${res.status} : ${reason}`);
  }
  return (body || {}) as KkiapayStatusResponse;
}

type FedapayStatusResponse = {
  id?: number;
  amount?: number;
  status?: string;
  reference?: string;
};

async function verifyFedapayWithCredentials(
  secrets: StorePaymentSecretPayload,
  transactionId: string,
): Promise<FedapayStatusResponse> {
  const secret = secrets.secretKey || '';
  if (!secret) throw new Error('Clé secrète FedaPay absente.');
  const isLive = secret.startsWith('sk_live');
  const base = isLive ? 'https://api.fedapay.com/v1' : 'https://sandbox-api.fedapay.com/v1';
  const res = await fetch(`${base}/transactions/${encodeURIComponent(transactionId)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${secret}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) throw new Error(`FedaPay API ${res.status}`);
  const raw = (body as Record<string, unknown>) || {};
  const tx = (raw['v1/transaction'] || raw.transaction || raw) as Record<string, unknown>;
  return {
    id: Number(tx.id || 0),
    amount: Number(tx.amount || 0),
    status: String(tx.status || '').toLowerCase(),
    reference: String(tx.reference || ''),
  };
}

export type StorePaymentRow = typeof orderPayments.$inferSelect;

async function markStorePaymentPaid(row: StorePaymentRow, reference: string): Promise<void> {
  await db
    .update(orderPayments)
    .set({
      status: 'PAID',
      reference: reference.slice(0, 200),
      paidAt: new Date(),
      updatedAt: new Date(),
      failureReason: null,
    })
    .where(and(eq(orderPayments.id, row.id), eq(orderPayments.status, 'PENDING')));

  await db
    .update(orders)
    .set({
      paymentStatus: 'PAID',
      paymentReference: reference.slice(0, 200),
      paymentProvider: row.provider,
    })
    .where(eq(orders.id, row.orderId));
}

export async function markStorePaymentFailed(
  paymentId: string,
  reason: string,
): Promise<void> {
  await db
    .update(orderPayments)
    .set({
      status: 'FAILED',
      failureReason: reason.slice(0, 300),
      updatedAt: new Date(),
    })
    .where(and(eq(orderPayments.id, paymentId), eq(orderPayments.status, 'PENDING')));

  const [row] = await db
    .select({ orderId: orderPayments.orderId })
    .from(orderPayments)
    .where(eq(orderPayments.id, paymentId))
    .limit(1);
  if (row?.orderId) {
    await db
      .update(orders)
      .set({ paymentStatus: 'FAILED' })
      .where(eq(orders.id, row.orderId));
  }
}

async function loadPaymentById(paymentId: string): Promise<StorePaymentRow | null> {
  const [row] = await db.select().from(orderPayments).where(eq(orderPayments.id, paymentId)).limit(1);
  return row || null;
}

async function loadPaymentByToken(token: string): Promise<StorePaymentRow | null> {
  const [row] = await db.select().from(orderPayments).where(eq(orderPayments.token, token)).limit(1);
  return row || null;
}

async function loadPaymentMethodConfig(storeId: string, provider: StorePaymentProvider) {
  const [row] = await db
    .select({ config: storePaymentMethods.config, enabled: storePaymentMethods.enabled })
    .from(storePaymentMethods)
    .where(
      and(eq(storePaymentMethods.storeId, storeId), eq(storePaymentMethods.provider, provider)),
    )
    .limit(1);
  return { config: pickPublicConfig(row?.config), enabled: row?.enabled ?? false };
}

/**
 * Vérifie un paiement auprès du fournisseur puis marque la commande payée.
 * `reference` est l'identifiant de transaction fourni par le widget (Kkiapay,
 * FedaPay) ; SasPay s'appuie sur la session créée côté serveur.
 */
export async function confirmStorePayment(input: {
  orderId: string;
  token: string;
  reference?: string;
}): Promise<{ success: boolean; status?: string; error?: string }> {
  const row = await loadPaymentByToken(input.token);
  if (!row || row.orderId !== input.orderId) {
    return { success: false, error: 'Paiement introuvable.' };
  }
  if (row.status === 'PAID') return { success: true, status: 'PAID' };
  if (row.status !== 'PENDING') {
    return { success: false, error: 'Ce paiement n’est plus en attente.' };
  }

  const provider = isStorePaymentProvider(row.provider) ? row.provider : null;
  if (!provider) return { success: false, error: 'Moyen de paiement inconnu.' };

  try {
    if (provider === 'kkiapay') {
      const reference = String(input.reference || '').trim();
      if (!reference) return { success: false, error: 'Référence Kkiapay manquante.' };
      const { config } = await loadPaymentMethodConfig(row.storeId, provider);
      const secrets = await loadStorePaymentCredential(row.storeId, provider);
      if (!config.publicKey || !secrets) {
        return { success: false, error: 'Le paiement Kkiapay de cette boutique est indisponible.' };
      }
      const tx = await verifyKkiapayWithCredentials(
        secrets,
        config.publicKey,
        reference,
        config.env || 'sandbox',
      );
      if (String(tx.status || '').toUpperCase() !== 'SUCCESS') {
        return { success: false, error: tx.failureMessage || tx.reason || 'Paiement non abouti.' };
      }
      if (Number(tx.amount) !== Math.round(Number(row.amount))) {
        return { success: false, error: 'Le montant payé ne correspond pas à la commande.' };
      }
      if (tx.partnerId && String(tx.partnerId) !== row.token) {
        return { success: false, error: 'Référence de transaction non concordante.' };
      }
      await markStorePaymentPaid(row, reference);
      return { success: true, status: 'PAID' };
    }

    if (provider === 'fedapay') {
      const reference = String(input.reference || '').trim();
      if (!reference) return { success: false, error: 'Référence FedaPay manquante.' };
      const secrets = await loadStorePaymentCredential(row.storeId, provider);
      if (!secrets?.secretKey) {
        return { success: false, error: 'Le paiement FedaPay de cette boutique est indisponible.' };
      }
      const tx = await verifyFedapayWithCredentials(secrets, reference);
      const status = String(tx.status || '').toLowerCase();
      if (!['approved', 'success', 'transferred', 'completed'].includes(status)) {
        return { success: false, error: `Paiement non abouti (statut : ${status || 'inconnu'}).` };
      }
      if (Number(tx.amount) !== Math.round(Number(row.amount))) {
        return { success: false, error: 'Le montant payé ne correspond pas à la commande.' };
      }
      await markStorePaymentPaid(row, reference);
      return { success: true, status: 'PAID' };
    }

    if (provider === 'saspay') {
      const secrets = await loadStorePaymentCredential(row.storeId, provider);
      if (!secrets?.apiKey) {
        return { success: false, error: 'Le paiement SasPay de cette boutique est indisponible.' };
      }
      const { getSaspayCheckoutStatus, verifySaspayPayment, saspayPaymentMatches } = await import(
        '@/lib/saspay'
      );
      if (!row.providerCheckoutId) {
        return { success: false, error: 'Session SasPay introuvable.' };
      }
      const session = await getSaspayCheckoutStatus(secrets.apiKey, row.providerCheckoutId);
      if (!session.transaction_id) {
        return { success: false, status: 'PENDING', error: 'Paiement en attente de confirmation.' };
      }
      const payment = await verifySaspayPayment(secrets.apiKey, session.transaction_id);
      if (
        !saspayPaymentMatches(session, payment, {
          sessionId: row.providerCheckoutId,
          amount: Math.round(Number(row.amount)),
          currency: 'XOF',
        })
      ) {
        return { success: false, status: 'PENDING', error: 'Paiement en attente de confirmation.' };
      }
      await markStorePaymentPaid(row, payment.id);
      return { success: true, status: 'PAID' };
    }

    return { success: false, error: 'Ce moyen de paiement ne peut pas être confirmé en ligne.' };
  } catch (error) {
    console.error('[store-payments] confirmation error:', error);
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'La vérification du paiement a échoué. Réessayez.',
    };
  }
}

/** Rapprochement côté webhook : retrouve le paiement par jeton ou référence. */
export async function findStorePaymentForWebhook(
  provider: StorePaymentProvider,
  input: { token?: string | null; reference?: string | null; checkoutId?: string | null },
): Promise<StorePaymentRow | null> {
  if (input.token) {
    const row = await loadPaymentByToken(input.token);
    if (row && row.provider === provider) return row;
  }
  if (input.checkoutId) {
    const [row] = await db
      .select()
      .from(orderPayments)
      .where(
        and(eq(orderPayments.provider, provider), eq(orderPayments.providerCheckoutId, input.checkoutId)),
      )
      .limit(1);
    if (row) return row;
  }
  if (input.reference) {
    const [row] = await db
      .select()
      .from(orderPayments)
      .where(and(eq(orderPayments.provider, provider), eq(orderPayments.reference, input.reference)))
      .limit(1);
    if (row) return row;
  }
  return null;
}

export async function confirmStorePaymentByRow(
  row: StorePaymentRow,
  reference: string,
): Promise<{ success: boolean; error?: string }> {
  const result = await confirmStorePayment({
    orderId: row.orderId,
    token: row.token,
    reference,
  });
  return { success: result.success, error: result.error };
}

export type StorePaymentClientView = {
  id: string;
  orderId: string;
  storeId: string;
  provider: StorePaymentProvider;
  providerLabel: string;
  amount: number;
  currency: string;
  status: string;
  token: string;
  checkoutUrl: string | null;
  publicKey: string | null;
  env: 'sandbox' | 'live';
  ussdCode: string | null;
  instructions: string | null;
  reference: string | null;
  error: string | null;
};

/** Construit la vue client d'un paiement (jamais de secret). */
export async function describeStorePaymentForClient(
  row: StorePaymentRow,
): Promise<StorePaymentClientView> {
  const provider = isStorePaymentProvider(row.provider) ? row.provider : 'cod';
  const { config } = await loadPaymentMethodConfig(row.storeId, provider);
  const secrets = isOnlineStorePayment(provider)
    ? await loadStorePaymentCredential(row.storeId, provider)
    : null;
  const env: 'sandbox' | 'live' =
    config.env ||
    (config.publicKey?.startsWith('pk_live') ||
    secrets?.secretKey?.startsWith('sk_live') ||
    secrets?.privateKey?.startsWith('live')
      ? 'live'
      : 'sandbox');
  return {
    id: row.id,
    orderId: row.orderId,
    storeId: row.storeId,
    provider,
    providerLabel: STORE_PAYMENT_LABELS[provider],
    amount: Number(row.amount) || 0,
    currency: row.currency || 'XOF',
    status: row.status,
    token: row.token,
    checkoutUrl: row.checkoutUrl || null,
    publicKey: config.publicKey || null,
    env,
    ussdCode: config.ussdCode || null,
    instructions: config.instructions || null,
    reference: row.reference || null,
    error: row.failureReason || null,
  };
}

export async function listStorePaymentsForOrders(orderIds: string[]): Promise<StorePaymentRow[]> {
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  if (ids.length === 0) return [];
  return db.select().from(orderPayments).where(inArray(orderPayments.orderId, ids));
}

/** Vérifie les commandes en attente d'un fournisseur (cron / retour SasPay). */
export async function reconcilePendingStorePaymentsForProvider(
  provider: StorePaymentProvider,
  limit = 25,
): Promise<number> {
  const rows = await db
    .select()
    .from(orderPayments)
    .where(and(eq(orderPayments.provider, provider), eq(orderPayments.status, 'PENDING')))
    .limit(limit);
  let paid = 0;
  for (const row of rows) {
    const result = await confirmStorePayment({
      orderId: row.orderId,
      token: row.token,
    });
    if (result.success) paid += 1;
  }
  return paid;
}

/**
 * SasPay ne fournit pas le jeton dans son webhook : on balaie les paiements
 * SasPay en attente dont la session correspond à l'identifiant reçu.
 */
export async function findSaspayPaymentByCheckoutId(checkoutId: string): Promise<StorePaymentRow | null> {
  const [row] = await db
    .select()
    .from(orderPayments)
    .where(
      and(eq(orderPayments.provider, 'saspay'), eq(orderPayments.providerCheckoutId, checkoutId)),
    )
    .limit(1);
  return row || null;
}
