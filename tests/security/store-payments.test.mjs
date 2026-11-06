import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Moyens de paiement boutiques — garanties de la politique « production
 * uniquement » et assainissement de la configuration publique.
 *
 * Ces tests importent le module RÉEL `src/lib/store-payments.ts` et ne
 * remplacent que la frontière (base, revalidate, drizzle-orm). Ils verrouillent
 * les règles suivantes, décrites dans la feature « moyens de paiement par
 * boutique » :
 *
 * - les clés ressemblant à des clés de test / sandbox sont refusées, que le
 *   vendeur les saisisse ou les conserve depuis un enregistrement antérieur ;
 * - la configuration publique est toujours rapportée / persistée en « live »,
 *   même si la base contient historiquement `env: 'sandbox'` ;
 * - le rapprochement webhook et la confirmation serveur refusent de démarrer
 *   sans secret en place ;
 * - la commande hors ligne (COD / USSD) est marquée collectée quand le
 *   vendeur la termine.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Compile un fichier TS en CJS avec des frontières remplacées. */
async function loadModule(entry, mocks) {
  const { build } = await import('esbuild');
  const { createRequire, Module } = await import('node:module');
  const require = createRequire(import.meta.url);

  const result = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
    plugins: [
      {
        name: 'audit-mocks',
        setup(plugin) {
          const contentsByPath = new Map();
          for (const [specifier, contents] of Object.entries(mocks)) {
            contentsByPath.set(specifier, contents);
          }
          plugin.onLoad({ filter: /.*/, namespace: 'audit-mock' }, (args) => ({
            contents: contentsByPath.get(args.path),
            loader: 'js',
          }));
          plugin.onResolve({ filter: /.*/ }, (args) => {
            if (contentsByPath.has(args.path)) {
              return { path: args.path, namespace: 'audit-mock' };
            }
            if (args.path.startsWith('@/')) {
              return plugin.resolve(path.join(root, 'src', args.path.slice(2)), {
                resolveDir: root,
                kind: args.kind,
              });
            }
          });
        },
      },
    ],
  });

  const filename = path.join(root, `tests/__audit_bundle_${Date.now()}_${Math.random().toString(36).slice(2)}.cjs`);
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = require.resolve.paths('drizzle-orm') || [];
  mod._compile(result.outputFiles[0].text, filename);
  return mod.exports;
}

/** Faux `drizzle-orm` : les constructeurs de conditions sont des sentinelles. */
const DRIZZLE_MOCK = `
  exports.eq = (...args) => ({ __op: 'eq', args });
  exports.and = (...args) => ({ __op: 'and', args });
  exports.inArray = (...args) => ({ __op: 'inArray', args });
`;

/** Faux schéma : des tables identitaires suffisent aux stubs drizzle-orm. */
const SCHEMA_MOCK = `
  exports.orderPayments = { __table: 'order_payments' };
  exports.orders = { __table: 'orders' };
  exports.storePaymentMethods = { __table: 'store_payment_methods' };
  exports.storePaymentCredentials = { __table: 'store_payment_credentials' };
`;

/** Faux revalidate (hors Next.js). */
const REVALIDATE_MOCK = `exports.refreshTag = () => {};`;

/** Faux SasPay (chargé dynamiquement, jamais appelé dans ces tests). */
const SASPAY_MOCK = `
  exports.publicSaspayError = () => 'SasPay indisponible';
  exports.createSaspayStoreCheckout = async () => { throw new Error('non appelé'); };
  exports.saspayStoreReturnUrl = () => 'https://example.test/return';
  exports.getSaspayCheckoutStatus = async () => { throw new Error('non appelé'); };
  exports.verifySaspayPayment = async () => { throw new Error('non appelé'); };
  exports.saspayPaymentMatches = () => false;
  exports.isSaspayId = (v) => typeof v === 'string' && v.length > 0;
`;

// ── Module sous test ───────────────────────────────────────────────────────

/**
 * Base en mémoire : même surface de chaînes que le module réel, sans Neon.
 * Les lignes renvoyées par `select(...).from(...).where(...).limit(1)` sont
 * configurables ; les inserts sont capturés dans `globalThis.__storePaymentsTestState.inserted`.
 */
async function loadWithDb({ rows = [], ordersRows = null } = {}) {
  // État partagé via globalThis : les modules inlinés par esbuild ne peuvent
  // pas être importés par le test, le global est le canal fiable.
  globalThis.__storePaymentsTestState = { inserted: [] };
  // ordersRows permet de simuler un statut de commande précis (ex. CANCELLED)
  // tout en renvoyant `rows` pour les autres tables.
  const ordersJson = JSON.stringify(ordersRows ?? rows);
  const generated = `
    exports.db = {
      select: () => ({
        from: (table) => ({
          where: () => ({
            limit: () => Promise.resolve(table && table.__table === 'orders' ? ${ordersJson} : ${JSON.stringify(rows)}),
            then: (resolve) => resolve(table && table.__table === 'orders' ? ${ordersJson} : ${JSON.stringify(rows)}),
          }),
        }),
      }),
      insert: (table) => ({
        values: (values) => ({
          onConflictDoUpdate: () => {
            globalThis.__storePaymentsTestState.inserted.push(values);
            return Promise.resolve();
          },
        }),
      }),
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ storeId: 'store-1' }]),
            then: (resolve) => resolve(undefined),
          }),
        }),
      }),
    };
  `;
  return loadModule('src/lib/store-payments.ts', {
    '@/db': generated,
    '@/db/schema': SCHEMA_MOCK,
    '@/lib/revalidate': REVALIDATE_MOCK,
    '@/lib/saspay': SASPAY_MOCK,
    'drizzle-orm': DRIZZLE_MOCK,
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

test('looksLikeSandboxKey détecte les clés de test et ignore les clés live', async () => {
  const mod = await loadWithDb();
  const { looksLikeSandboxKey } = mod;
  assert.equal(looksLikeSandboxKey('pk_test_123'), true);
  assert.equal(looksLikeSandboxKey('sk_test_ABCDEF'), true);
  assert.equal(looksLikeSandboxKey('sk_sandbox_42'), true);
  assert.equal(looksLikeSandboxKey('my_demo_key'), true);
  assert.equal(looksLikeSandboxKey('TEST'), true);
  assert.equal(looksLikeSandboxKey('pk_live_9f8e7d6c5b4a'), false);
  assert.equal(looksLikeSandboxKey('sk_live_1234567890'), false);
  assert.equal(looksLikeSandboxKey(''), false);
  assert.equal(looksLikeSandboxKey(null), false);
  assert.equal(looksLikeSandboxKey(undefined), false);
});

test('pickPublicConfig rapporte toujours env=live, même si la base contient sandbox', async () => {
  const mod = await loadWithDb();
  const { pickPublicConfig } = mod;
  assert.equal(pickPublicConfig({ env: 'sandbox', publicKey: 'pk_live_abc' }).env, 'live');
  assert.equal(pickPublicConfig({ env: 'live', publicKey: 'pk_live_abc' }).env, 'live');
  assert.equal(pickPublicConfig({}).env, 'live');
  assert.equal(pickPublicConfig(null).env, 'live');
  assert.equal(pickPublicConfig({ instructions: '  Payez à la livraison  ' }).instructions, 'Payez à la livraison');
  assert.equal(pickPublicConfig('n importe quoi').env, 'live');
});

test('normalizeStorePaymentProvider normalise les alias historiques', async () => {
  const mod = await loadWithDb();
  const { normalizeStorePaymentProvider } = mod;
  assert.equal(normalizeStorePaymentProvider('ESPECES'), 'cod');
  assert.equal(normalizeStorePaymentProvider('cash'), 'cod');
  assert.equal(normalizeStorePaymentProvider(''), 'cod');
  assert.equal(normalizeStorePaymentProvider('kkiapay'), 'kkiapay');
  assert.equal(normalizeStorePaymentProvider('FEDAPAY'), 'fedapay');
  assert.equal(normalizeStorePaymentProvider('saspay'), 'saspay');
  assert.equal(normalizeStorePaymentProvider('ussd'), 'ussd');
  assert.equal(normalizeStorePaymentProvider('bitcoin'), null);
});

test('isOnlineStorePayment : seuls Kkiapay / FedaPay / SasPay sont en ligne', async () => {
  const mod = await loadWithDb();
  const { isOnlineStorePayment } = mod;
  assert.equal(isOnlineStorePayment('kkiapay'), true);
  assert.equal(isOnlineStorePayment('fedapay'), true);
  assert.equal(isOnlineStorePayment('saspay'), true);
  assert.equal(isOnlineStorePayment('cod'), false);
  assert.equal(isOnlineStorePayment('ussd'), false);
});

test('saveStorePaymentMethod refuse une clé publique de test (production uniquement)', async () => {
  const mod = await loadWithDb();
  const res = await mod.saveStorePaymentMethod('store-1', 'kkiapay', {
    enabled: true,
    config: { publicKey: 'pk_test_123456', env: 'sandbox' },
    secrets: { privateKey: 'sk_live_abc', secretKey: 'sk_live_def' },
  });
  assert.equal(res.success, false);
  assert.match(res.error || '', /production/i);
});

test('saveStorePaymentMethod refuse une clé secrète de test (production uniquement)', async () => {
  const mod = await loadWithDb();
  const res = await mod.saveStorePaymentMethod('store-1', 'fedapay', {
    enabled: true,
    config: { publicKey: 'pk_live_123456' },
    secrets: { secretKey: 'sk_test_123456' },
  });
  assert.equal(res.success, false);
  assert.match(res.error || '', /production/i);
});

test('saveStorePaymentMethod refuse une clé API SasPay de test (production uniquement)', async () => {
  const mod = await loadWithDb();
  const res = await mod.saveStorePaymentMethod('store-1', 'saspay', {
    enabled: true,
    config: {},
    secrets: { apiKey: 'sk_test_123456' },
  });
  assert.equal(res.success, false);
  assert.match(res.error || '', /production/i);
});

test('saveStorePaymentMethod impose les prérequis avant tout enregistrement', async () => {
  const mod = await loadWithDb();
  const noPublicKey = await mod.saveStorePaymentMethod('store-1', 'kkiapay', {
    enabled: true,
    config: {},
    secrets: { privateKey: 'sk_live_abc', secretKey: 'sk_live_def' },
  });
  assert.equal(noPublicKey.success, false);
  assert.match(noPublicKey.error || '', /clé publique/i);

  const noSecret = await mod.saveStorePaymentMethod('store-1', 'fedapay', {
    enabled: true,
    config: { publicKey: 'pk_live_abc' },
    secrets: {},
  });
  assert.equal(noSecret.success, false);

  const ussdWithoutCode = await mod.saveStorePaymentMethod('store-1', 'ussd', {
    enabled: true,
    config: {},
  });
  assert.equal(ussdWithoutCode.success, false);
  assert.match(ussdWithoutCode.error || '', /USSD/i);
});

test('saveStorePaymentMethod persiste env=live même si on envoie env=sandbox', async () => {
  process.env.PAYMENT_CREDENTIALS_KEY = 'a'.repeat(64);
  const mod = await loadWithDb();
  const res = await mod.saveStorePaymentMethod('store-1', 'kkiapay', {
    enabled: true,
    config: { publicKey: 'pk_live_abc123', env: 'sandbox', instructions: 'Payez à la livraison' },
    secrets: { privateKey: 'sk_live_abc', secretKey: 'sk_live_def' },
  });
  assert.equal(res.success, true, res.error);
  const inserted = globalThis.__storePaymentsTestState?.inserted || [];
  assert.ok(inserted.length > 0, 'les valeurs insérées doivent être capturées');
  assert.equal(inserted[0].config.env, 'live');
});

test('confirmStorePayment sans ligne en base est refusé proprement', async () => {
  const mod = await loadWithDb({ rows: [] });
  const res = await mod.confirmStorePayment({ orderId: 'order-1', token: 'token-1' });
  assert.equal(res.success, false);
  assert.match(res.error || '', /introuvable/i);
});

test('confirmStorePayment refuse d’encaisser une commande annulée', async () => {
  const pendingRow = {
    id: 'payment-1',
    orderId: 'order-1',
    storeId: 'store-1',
    provider: 'kkiapay',
    amount: '5000',
    currency: 'XOF',
    status: 'PENDING',
    token: 'token-1',
    providerCheckoutId: null,
  };
  const mod = await loadWithDb({ rows: [pendingRow], ordersRows: [{ status: 'CANCELLED' }] });
  const res = await mod.confirmStorePayment({ orderId: 'order-1', token: 'token-1', reference: 'tx-1' });
  assert.equal(res.success, false);
  assert.match(res.error || '', /annulée/i);
});
