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
import { refreshTag } from '@/lib/revalidate';

/**
 * Moyens de paiement par boutique.
 *
 * Ce module est strictement serveur : il déchiffre les secrets des vendeurs et
 * appelle les API des fournisseurs. Les seules données renvoyées au navigateur
 * sont les clés publiques et les instructions d'encaissement.
 *
 * Moyens proposés aux boutiques : COD, Kkiapay, FedaPay. SasPay et USSD ont
 * été retirés pour les nouvelles configurations ; les lignes historiques
 * (commandes déjà passées) restent lisibles et réconciliables.
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

/** Moyens réellement proposés aux boutiques (SasPay / USSD retirés). */
export const SUPPORTED_STORE_PROVIDERS: StorePaymentProvider[] = ['cod', 'kkiapay', 'fedapay'];
const SUPPORTED_SET = new Set<string>(SUPPORTED_STORE_PROVIDERS);

export function isSupportedStoreProvider(value: unknown): value is StorePaymentProvider {
  return typeof value === 'string' && SUPPORTED_SET.has(value);
}

// Aligné sur src/db/api.ts (isCancelledOrderStatus) — dupliqué ici pour
// garder ce module autonome.
const CANCELLED_ORDER_STATUSES = new Set(['CANCELLED', 'ANNULEE']);
const isCancelledOrderStatus = (status?: string | null): boolean =>
  CANCELLED_ORDER_STATUSES.has(String(status || '').toUpperCase());

export type PublicStorePaymentConfig = {
  instructions?: string;
  ussdCode?: string;
  publicKey?: string;
  /**
   * Environnement choisi par la boutique dans sa configuration
   * (« live » par défaut, « sandbox » au choix pour les tests).
   */
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

/**
 * En mode production (défaut), toute clé qui ressemble à une clé de test /
 * sandbox est refusée. Le test porte sur le mot entier (délimité par des
 * non-alphanumériques ou des bords) pour ne pas rejeter une clé aléatoire
 * contenant « test » par hasard de façon trop agressive, tout en attrapant
 * pk_test_…, sk_test_…, sk_sandbox_…, my_demo_key, etc.
 * sk_sandbox_…, my_demo_key, etc.
 */
export function looksLikeSandboxKey(value: unknown): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  return /(^|[^a-z0-9])(test|sandbox|demo)([^a-z]|$)/.test(v);
}

/**
 * Miroir de `looksLikeSandboxKey` pour le mode Sandbox : une clé qui porte
 * le marqueur « live » (pk_live_…, sk_live_…, wh_live_…) y est refusée afin
 * qu'aucune vraie transaction ne parte avec une configuration de test.
 */
export function looksLikeLiveKey(value: unknown): boolean {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return false;
  return /(^|[^a-z0-9])live([^a-z]|$)/.test(v);
}

/** Environnement normalisé d'une configuration publique (défaut : live). */
export function publicConfigEnv(config: { env?: 'sandbox' | 'live' } | null | undefined): 'sandbox' | 'live' {
  return config?.env === 'sandbox' ? 'sandbox' : 'live';
}

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
  // SasPay / USSD : retirés pour les nouvelles commandes.
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

/**
 * Assainit la configuration publique d'un moyen de paiement. `env` est
 * conservé tel que choisi par la boutique ; toute valeur absente ou inconnue
 * retombe sur « live » (production).
 */
export function pickPublicConfig(raw: unknown): PublicStorePaymentConfig {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const config: PublicStorePaymentConfig = {};
  const instructions = String(value.instructions || '').trim();
  const ussdCode = String(value.ussdCode || value.ussd_code || '').trim();
  const publicKey = String(value.publicKey || value.public_key || '').trim();
  if (instructions) config.instructions = instructions.slice(0, 500);
  if (ussdCode) config.ussdCode = ussdCode.slice(0, 80);
  if (publicKey) config.publicKey = publicKey.slice(0, 200);
  config.env = String(value.env || '').trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
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
    if (!isSupportedStoreProvider(row.provider)) continue;
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

  return SUPPORTED_STORE_PROVIDERS.map((provider) => {
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

function keyHintFor(_provider: StorePaymentProvider, payload: StorePaymentSecretPayload): string | null {
  const value = payload.apiKey || payload.secretKey || payload.privateKey || '';
  if (!value) return null;
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
  if (!isSupportedStoreProvider(provider)) {
    return {
      success: false,
      error: 'Ce moyen de paiement n’est plus pris en charge pour les boutiques.',
    };
  }
  const enabled = Boolean(input.enabled);
  const config = pickPublicConfig(input.config);
  const nextSecrets = pickSecretPayload(input.secrets);
  const hasNewSecret = Object.keys(nextSecrets).length > 0;
  const existingSecret = await loadStorePaymentCredential(storeId, provider);
  // Fusion champ à champ : un champ laissé vide conserve le secret déjà
  // enregistré (« Laisser vide pour conserver ») au lieu d'écraser toute la
  // ligne avec les seuls champs nouvellement saisis.
  const mergedSecrets: StorePaymentSecretPayload = hasNewSecret
    ? { ...(existingSecret ?? {}), ...nextSecrets }
    : (existingSecret ?? {});

  if (enabled) {
    if (provider === 'kkiapay') {
      if (!config.publicKey) return { success: false, error: 'Renseignez la clé publique Kkiapay.' };
      if (!mergedSecrets.privateKey || !mergedSecrets.secretKey) {
        return { success: false, error: 'Renseignez les clés privée et secrète Kkiapay.' };
      }
    }
    if (provider === 'fedapay') {
      if (!config.publicKey) return { success: false, error: 'Renseignez la clé publique FedaPay.' };
      if (!mergedSecrets.secretKey) {
        return { success: false, error: 'Renseignez la clé secrète FedaPay.' };
      }
    }
    // Cohérence mode ↔ clés : en production, toute clé ressemblant à une
    // clé de test est refusée ; en Sandbox, toute clé live est refusée.
    // S'applique aussi aux clés conservées depuis un enregistrement antérieur.
    if (isOnlineStorePayment(provider)) {
      const env = publicConfigEnv(config);
      const candidates: Array<[string, string | undefined]> = [
        ['clé publique', config.publicKey],
        ['clé privée', mergedSecrets.privateKey],
        ['clé secrète', mergedSecrets.secretKey],
        ['clé API', mergedSecrets.apiKey],
        ['secret webhook', mergedSecrets.webhookSecret],
      ];
      for (const [label, value] of candidates) {
        if (!value) continue;
        if (env === 'live' && looksLikeSandboxKey(value)) {
          return {
            success: false,
            error: `La ${label} ressemble à une clé de test. Les paiements boutiques fonctionnent en mode production par défaut ; utilisez vos clés live (ou basculez en Sandbox pour tester).`,
          };
        }
        if (env === 'sandbox' && looksLikeLiveKey(value)) {
          return {
            success: false,
            error: `La ${label} ressemble à une clé de production. En mode Sandbox, utilisez vos clés de test.`,
          };
        }
      }
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
      // On persiste la fusion complète : les clés conservées ne sont jamais
      // perdues lorsque seule une partie est réenregistrée.
      encrypted = encryptPaymentSecret(mergedSecrets);
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
        keyHint: keyHintFor(provider, mergedSecrets),
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
    const env = publicConfigEnv(config);
    if (!config.publicKey || !secrets) {
      return { ok: false, error: 'Le paiement en ligne de cette boutique est mal configuré.' };
    }
    // Cohérence mode ↔ clés : une boutique en production refuse les clés de
    // test (aucun widget ne s'ouvre), et une boutique en Sandbox refuse les
    // clés live (aucune vraie transaction ne part par erreur).
    if (env === 'live' && (looksLikeSandboxKey(config.publicKey) || Object.values(secrets).some(looksLikeSandboxKey))) {
      return {
        ok: false,
        error: 'Les clés de cette boutique ressemblent à des clés de test. Le mode production est requis (ou basculez la boutique en Sandbox pour tester).',
      };
    }
    if (env === 'sandbox' && (looksLikeLiveKey(config.publicKey) || Object.values(secrets).some(looksLikeLiveKey))) {
      return {
        ok: false,
        error: 'Les clés de cette boutique ressemblent à des clés de production. En mode Sandbox, utilisez vos clés de test.',
      };
    }
    return { ok: true, publicKey: config.publicKey, env };
  }

  // SasPay : le guichet est hébergé, il faut créer une session côté serveur.
  const secrets = await loadStorePaymentCredential(input.storeId, 'saspay');
  if (!secrets?.apiKey) {
    return { ok: false, error: 'La clé API SasPay de cette boutique est absente.' };
  }
  if (looksLikeSandboxKey(secrets.apiKey)) {
    return {
      ok: false,
      error: 'La clé API SasPay de cette boutique ressemble à une clé de test. Le mode production est requis.',
    };
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

// Hôtes fournisseurs selon l'environnement choisi par la boutique.
const KKIAPAY_API_BASE_LIVE = 'https://api.kkiapay.me';
const KKIAPAY_API_BASE_SANDBOX = 'https://api-sandbox.kkiapay.me';
const FEDAPAY_API_BASE_LIVE = 'https://api.fedapay.com/v1';
const FEDAPAY_API_BASE_SANDBOX = 'https://sandbox-api.fedapay.com/v1';

async function verifyKkiapayWithCredentials(
  secrets: StorePaymentSecretPayload,
  publicKey: string,
  transactionId: string,
  env: 'sandbox' | 'live' = 'live',
): Promise<KkiapayStatusResponse> {
  const apiBase = env === 'sandbox' ? KKIAPAY_API_BASE_SANDBOX : KKIAPAY_API_BASE_LIVE;
  const res = await fetch(`${apiBase}/api/v1/transactions/status`, {
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
  env: 'sandbox' | 'live' = 'live',
): Promise<FedapayStatusResponse> {
  const secret = secrets.secretKey || '';
  if (!secret) throw new Error('Clé secrète FedaPay absente.');
  const base = env === 'sandbox' ? FEDAPAY_API_BASE_SANDBOX : FEDAPAY_API_BASE_LIVE;
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
  // Le vendeur doit voir « Payé » sans attendre l'expiration des caches.
  refreshTag(`orders:${row.storeId}`);
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
    .select({ orderId: orderPayments.orderId, storeId: orderPayments.storeId })
    .from(orderPayments)
    .where(eq(orderPayments.id, paymentId))
    .limit(1);
  if (row?.orderId) {
    await db
      .update(orders)
      .set({ paymentStatus: 'FAILED' })
      .where(eq(orders.id, row.orderId));
    refreshTag(`orders:${row.storeId}`);
  }
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
 * Vérifie un paiement en ligne PRÉ-ENCAISSÉ (flux « paiement avant commande ») :
 * statut succès, montant exact, partenaire concordant. N'écrit RIEN — la
 * décision d'insérer la commande revient à l'appelant.
 */
export async function verifyPrepaidStorePayment(input: {
  storeId: string;
  provider: StorePaymentProvider;
  amount: number;
  reference: string;
  partnerId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const provider = input.provider;
  const reference = String(input.reference || '').trim();
  const expectedAmount = Math.round(Number(input.amount));
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    return { ok: false, error: 'Montant invalide.' };
  }
  if (!reference) return { ok: false, error: 'Référence de paiement manquante.' };
  if (provider === 'cod') return { ok: true };
  const secrets = await loadStorePaymentCredential(input.storeId, provider);

  if (provider === 'kkiapay') {
    const { config } = await loadPaymentMethodConfig(input.storeId, provider);
    if (!config.publicKey || !secrets) {
      return { ok: false, error: 'Le paiement Kkiapay de cette boutique est indisponible.' };
    }
    const env = publicConfigEnv(config);
    if (env === 'live' && (looksLikeSandboxKey(config.publicKey) || Object.values(secrets).some(looksLikeSandboxKey))) {
      return { ok: false, error: 'Les clés de cette boutique ressemblent à des clés de test.' };
    }
    if (env === 'sandbox' && (looksLikeLiveKey(config.publicKey) || Object.values(secrets).some(looksLikeLiveKey))) {
      return { ok: false, error: 'Les clés de cette boutique ressemblent à des clés de production.' };
    }
    const tx = await verifyKkiapayWithCredentials(secrets, config.publicKey, reference, env);
    if (String(tx.status || '').toUpperCase() !== 'SUCCESS') {
      return { ok: false, error: tx.failureMessage || tx.reason || 'Paiement non abouti.' };
    }
    if (Number(tx.amount) !== expectedAmount) {
      return { ok: false, error: 'Le montant payé ne correspond pas à la commande.' };
    }
    if (tx.partnerId && input.partnerId && String(tx.partnerId) !== input.partnerId) {
      return { ok: false, error: 'Référence de transaction non concordante.' };
    }
    return { ok: true };
  }

  if (provider === 'fedapay') {
    const { config } = await loadPaymentMethodConfig(input.storeId, provider);
    const env = publicConfigEnv(config);
    if (!secrets?.secretKey) {
      return { ok: false, error: 'Le paiement FedaPay de cette boutique est indisponible.' };
    }
    if (env === 'live' && Object.values(secrets).some(looksLikeSandboxKey)) {
      return { ok: false, error: 'Les clés de cette boutique ressemblent à des clés de test.' };
    }
    if (env === 'sandbox' && (looksLikeLiveKey(secrets.secretKey) || looksLikeLiveKey(config.publicKey))) {
      return { ok: false, error: 'Les clés de cette boutique ressemblent à des clés de production.' };
    }
    const tx = await verifyFedapayWithCredentials(secrets, reference, env);
    const status = String(tx.status || '').toLowerCase();
    if (!['approved', 'success', 'transferred', 'completed'].includes(status)) {
      return { ok: false, error: `Paiement non abouti (statut : ${status || 'inconnu'}).` };
    }
    if (Number(tx.amount) !== expectedAmount) {
      return { ok: false, error: 'Le montant payé ne correspond pas à la commande.' };
    }
    return { ok: true };
  }

  return { ok: false, error: 'Moyen de paiement inconnu.' };
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

  // Une commande annulée ne doit plus encaisser : on ferme le paiement
  // (FAILED) plutôt que de laisser le client payer une commande morte.
  try {
    const [orderRow] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, row.orderId))
      .limit(1);
    if (orderRow && isCancelledOrderStatus(orderRow.status)) {
      await markStorePaymentFailed(row.id, 'Commande annulée.');
      return { success: false, error: 'Cette commande a été annulée.' };
    }
  } catch (error) {
    console.error('[store-payments] vérification statut commande:', error);
  }

  try {
    if (provider === 'kkiapay') {
      const reference = String(input.reference || '').trim();
      if (!reference) return { success: false, error: 'Référence Kkiapay manquante.' };
      const { config } = await loadPaymentMethodConfig(row.storeId, provider);
      const env = publicConfigEnv(config);
      const secrets = await loadStorePaymentCredential(row.storeId, provider);
      if (!config.publicKey || !secrets) {
        return { success: false, error: 'Le paiement Kkiapay de cette boutique est indisponible.' };
      }
      const tx = await verifyKkiapayWithCredentials(
        secrets,
        config.publicKey,
        reference,
        env,
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
      const { config } = await loadPaymentMethodConfig(row.storeId, provider);
      const env = publicConfigEnv(config);
      const secrets = await loadStorePaymentCredential(row.storeId, provider);
      if (!secrets?.secretKey) {
        return { success: false, error: 'Le paiement FedaPay de cette boutique est indisponible.' };
      }
      const tx = await verifyFedapayWithCredentials(secrets, reference, env);
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

/**
 * Encaissement hors ligne (COD / USSD) marqué payé lorsque le vendeur mène
 * la commande à son terme : l'argent est encaissé en main propre. Les
 * paiements en ligne (Kkiapay / FedaPay / SasPay) sont volontairement
 * exclus — seul le serveur les marque PAID, après vérification.
 */
export async function markOfflineStorePaymentCollected(orderId: string): Promise<void> {
  const cleanOrderId = String(orderId || '').trim();
  if (!cleanOrderId) return;
  const rows = await db
    .update(orderPayments)
    .set({ status: 'PAID', paidAt: new Date(), updatedAt: new Date(), failureReason: null })
    .where(
      and(
        eq(orderPayments.orderId, cleanOrderId),
        eq(orderPayments.status, 'PENDING'),
        inArray(orderPayments.provider, ['cod', 'ussd']),
      ),
    )
    .returning({ storeId: orderPayments.storeId });
  if (rows.length === 0) return;
  await db
    .update(orders)
    .set({ paymentStatus: 'PAID' })
    .where(
      and(
        eq(orders.id, cleanOrderId),
        eq(orders.paymentStatus, 'PENDING'),
        inArray(orders.paymentProvider, ['cod', 'ussd']),
      ),
    );
  for (const row of rows) refreshTag(`orders:${row.storeId}`);
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
  const env = publicConfigEnv(config);
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
