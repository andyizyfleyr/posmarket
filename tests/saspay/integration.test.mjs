import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(import.meta.url);
const KEY = 'sk_test_fake_for_integration_tests';
const SECRET = 'fake-signing-secret';
const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_USER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessions = [
  'c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e6f',
  'c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e70',
  'c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e71',
  'c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e72',
  'c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e73',
];
const transactions = [
  '9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02',
  '9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a03',
  '9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a04',
  '9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a05',
  '9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a06',
];

// Les seuls remplacements sont l'accès Neon, les notifications et le contexte
// Next. Le service, le route handler, les requêtes Drizzle et la migration sont réels.
async function loadServerModule(entry) {
  const mocks = {
    db: 'exports.db = globalThis.__saspayTestDb;',
    config: 'exports.loadPaymentConfig = async () => globalThis.__saspayTestConfig;',
    mobile: 'exports.requireSellerSpace = async () => ({ ok: true, userId: globalThis.__saspayUserId });',
    validation: 'exports.parseBody = async req => ({ ok: true, data: await req.json() });',
    schemas: 'exports.subscriptionActionSchema = {};',
    cache: 'exports.refreshTag = () => { globalThis.__saspayCacheRefreshes++; };',
    notifications: `
      exports.getProfilePhone = async () => '';
      exports.getProfileEmail = async () => 'seller@example.test';
      exports.notify = async () => { globalThis.__saspayNotifications++; };
    `,
    next: `
      exports.after = fn => globalThis.__saspayAfter.push(fn);
      exports.NextResponse = { json: (body, init) => Response.json(body, init) };
    `,
  };
  const result = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
    plugins: [{
      name: 'saspay-integration-mocks',
      setup(plugin) {
        const ids = new Map([
          ['@/db', 'db'], ['@/lib/paymentConfig', 'config'], ['@/lib/revalidate', 'cache'],
          ['@/lib/mobile-space', 'mobile'], ['@/lib/validation', 'validation'], ['@/lib/schemas', 'schemas'],
          ['@/lib/notifications', 'notifications'], ['next/server', 'next'],
        ]);
        plugin.onResolve({ filter: /^(?:@\/db$|@\/lib\/paymentConfig$|@\/lib\/revalidate$|@\/lib\/mobile-space$|@\/lib\/validation$|@\/lib\/schemas$|@\/lib\/notifications$|next\/server$)/ }, args => ({ path: ids.get(args.path), namespace: 'mock' }));
        plugin.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents: mocks[args.path], loader: 'js' }));
        plugin.onResolve({ filter: /^@\// }, args => plugin.resolve(path.join(root, 'src', args.path.slice(2)), { resolveDir: root, kind: args.kind }));
      },
    }],
  });
  const filename = path.join(root, 'tests/saspay/__runtime_test_bundle.cjs');
  const mod = new Module(filename);
  mod.filename = filename;
  mod.paths = require.resolve.paths('drizzle-orm') || [];
  mod._compile(result.outputFiles[0].text, filename);
  return mod.exports;
}

function response(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data, code: status }), { status });
}

function mobileRequest(body) {
  return new Request('https://shop.example.test/api/marketplace/seller/subscription', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
}

function signedRequest(event, data, options = {}) {
  const body = JSON.stringify({ event, data });
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));
  const signature = options.signature ?? createHmac('sha256', SECRET).update(`${timestamp}.${body}`).digest('hex');
  return new Request('https://shop.example.test/api/saspay/webhook', {
    method: 'POST', body,
    headers: { 'content-type': 'application/json', 'x-webhook-signature': signature, 'x-webhook-timestamp': timestamp, 'x-webhook-event': event },
  });
}

test('parcours réel du service et du webhook sur PostgreSQL local', async t => {
  const pg = new PGlite();
  const oldFetch = globalThis.fetch;
  const oldAppUrl = process.env.APP_URL;
  const oldConsoleError = console.error;
  t.after(async () => {
    globalThis.fetch = oldFetch;
    console.error = oldConsoleError;
    if (oldAppUrl === undefined) delete process.env.APP_URL; else process.env.APP_URL = oldAppUrl;
    delete globalThis.__saspayTestDb;
    delete globalThis.__saspayTestConfig;
    delete globalThis.__saspayUserId;
    delete globalThis.__saspayAfter;
    delete globalThis.__saspayNotifications;
    delete globalThis.__saspayCacheRefreshes;
    await pg.close();
  });
  console.error = () => {}; // erreur simulée attendue dans le test de webhook
  await pg.exec(`
    CREATE TABLE profiles (
      id uuid PRIMARY KEY, email text NOT NULL, full_name text, phone text,
      subscription_tier text, subscription_duration text, subscription_status text,
      subscription_start_date timestamp, subscription_end_date timestamp
    );
    CREATE TABLE subscription_payments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES profiles(id),
      tier text NOT NULL, duration text NOT NULL, amount integer NOT NULL, currency text NOT NULL DEFAULT 'XOF',
      transaction_id text UNIQUE, reference text, status text NOT NULL DEFAULT 'PENDING',
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await pg.exec(await readFile(path.join(root, 'drizzle/0025_saspay_subscriptions.sql'), 'utf8'));
  await pg.query('INSERT INTO profiles (id, email, full_name) VALUES ($1, $2, $3), ($4, $5, $6)', [USER, 'seller@example.test', 'Test Seller', OTHER_USER, 'other@example.test', 'Other']);
  globalThis.__saspayTestDb = drizzle(pg);
  globalThis.__saspayTestConfig = { provider: 'saspay', saspayApiKey: KEY, saspayWebhookSecret: SECRET };
  globalThis.__saspayUserId = USER;
  globalThis.__saspayAfter = [];
  globalThis.__saspayNotifications = 0;
  globalThis.__saspayCacheRefreshes = 0;
  process.env.APP_URL = 'https://shop.example.test';

  const service = await loadServerModule('src/lib/saspaySubscriptions.ts');
  const webhook = await loadServerModule('src/app/api/saspay/webhook/route.ts');
  const mobile = await loadServerModule('src/app/api/marketplace/seller/subscription/route.ts');
  let checkoutIndex = 0;
  let createFailure = null;
  let apiCalls = [];
  const state = sessions.map((session, index) => ({ session, transaction: transactions[index], status: 'PENDING', amount: index === 0 ? '12000.00' : '15000.00', currency: 'XOF' }));
  globalThis.fetch = async (url, options) => {
    const target = new URL(url);
    apiCalls.push({ url: String(url), method: options.method });
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
    if (target.pathname === '/api/v1/checkout-sessions/' && options.method === 'POST') {
      const current = state[checkoutIndex++];
      const sent = JSON.parse(options.body);
      assert.equal(sent.amount, current.amount);
      assert.equal(sent.customer_email, 'seller@example.test');
      assert.equal(sent.customer_name, 'Test Seller');
      current.localTransactionId = sent.metadata.posmarket_payment_id;
      if (createFailure === 'network') throw new Error('Coupure réseau simulée');
      if (createFailure === 422) return new Response('{}', { status: 422 });
      return response({ id: current.session, checkout_url: `https://pay.saspay.me/checkout/${checkoutIndex}` }, 201);
    }
    if (target.pathname === '/api/v1/checkout-sessions/') {
      return response({ results: state.filter(s => s.status === 'PAID').map(s => ({ id: s.session, transaction: s.transaction, metadata: { posmarket_payment_id: s.localTransactionId } })) });
    }
    const session = state.find(s => target.pathname === `/api/v1/checkout-sessions/${s.session}/status/`);
    if (session) return response({ id: session.session, status: session.status, transaction_id: session.status === 'PAID' ? session.transaction : null });
    const transaction = state.find(s => target.pathname === `/api/v1/payments/${s.transaction}/verify/`);
    if (transaction) return response({ id: transaction.transaction, status: 'SUCCESS', requested_amount: transaction.amount, currency: transaction.currency, debited_amount: transaction.amount, net_amount: transaction.amount, fee_charge_mode: 'DEDUCTED' });
    throw new Error(`URL simulée inconnue: ${target.pathname}`);
  };

  const publicConfig = await (await mobile.GET()).text();
  assert.equal(JSON.parse(publicConfig).provider, 'saspay');
  assert.equal(publicConfig.includes(KEY), false);
  assert.equal(publicConfig.includes(SECRET), false);
  const bypass = await mobile.POST(mobileRequest({ action: 'update', tier: 'STARTER', duration: 'monthly' }));
  assert.equal((await bypass.json()).success, false);

  const created = await mobile.POST(mobileRequest({ action: 'create', tier: 'STARTER', duration: 'monthly' }));
  const first = await created.json();
  assert.equal(first.success, true);
  assert.match(first.paymentUrl, /^https:\/\/pay\.saspay\.me\//);
  assert.ok(first.returnUrl.includes(first.transactionId));
  assert.equal(JSON.stringify(first).includes(KEY), false);
  assert.equal(await service.reconcileSaspaySubscription({ transactionId: first.transactionId, userId: OTHER_USER, apiKey: KEY }), 'not_found');
  assert.equal(await service.reconcileSaspaySubscription({ transactionId: first.transactionId, userId: USER, apiKey: KEY }), 'pending');
  const pendingMobile = await mobile.POST(mobileRequest({ action: 'confirm', transactionId: first.transactionId, reference: 'forged' }));
  assert.equal((await pendingMobile.json()).code, 'PENDING');

  // La session payée mais avec une mauvaise devise ne doit rien activer.
  state[0].status = 'PAID';
  state[0].currency = 'XAF';
  await assert.rejects(service.reconcileSaspaySubscription({ transactionId: first.transactionId, userId: USER, apiKey: KEY }));
  let profile = (await pg.query('SELECT subscription_status FROM profiles WHERE id = $1', [USER])).rows[0];
  assert.equal(profile.subscription_status, null);
  state[0].currency = 'XOF';
  const [mobileConfirmed, concurrent] = await Promise.all([
    mobile.POST(mobileRequest({ action: 'confirm', transactionId: first.transactionId, reference: 'forged' })),
    service.reconcileSaspaySubscription({ transactionId: first.transactionId, userId: USER, apiKey: KEY }),
  ]);
  assert.equal((await mobileConfirmed.json()).success, true);
  assert.equal(concurrent, 'approved');
  assert.equal(globalThis.__saspayAfter.length, 1);
  await globalThis.__saspayAfter.shift()();
  assert.equal(globalThis.__saspayNotifications, 1);
  assert.equal(globalThis.__saspayCacheRefreshes, 2);
  profile = (await pg.query('SELECT subscription_status, subscription_tier FROM profiles WHERE id = $1', [USER])).rows[0];
  assert.equal(profile.subscription_status, 'ACTIVE');
  assert.equal(profile.subscription_tier, 'STARTER');

  const second = await service.createSaspaySubscriptionPayment(USER, 'PRO', 'monthly', KEY);
  apiCalls = [];
  assert.equal((await webhook.POST(new Request('https://shop.example.test/api/saspay/webhook', { method: 'POST', body: 'x'.repeat(65_537) }))).status, 413);
  assert.equal((await webhook.POST(signedRequest('transaction.success', { id: transactions[1] }, { signature: '0'.repeat(64) }))).status, 401);
  assert.equal((await webhook.POST(signedRequest('transaction.success', { id: transactions[1] }, { timestamp: Math.floor(Date.now() / 1000) - 301 }))).status, 401);
  assert.equal(apiCalls.length, 0);
  assert.equal((await webhook.POST(signedRequest('webhook.test', {}))).status, 200);
  assert.equal((await webhook.POST(signedRequest('transaction.failed', { id: transactions[1] }))).status, 200);
  // Le webhook peut précéder la mise à jour de la liste : demander un retry.
  assert.equal((await webhook.POST(signedRequest('transaction.success', { id: transactions[1] }))).status, 503);
  state[1].status = 'PAID';
  const ok = await webhook.POST(signedRequest('transaction.success', { id: transactions[1] }));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).status, 'approved');
  assert.equal(globalThis.__saspayAfter.length, 1);
  const callsBeforeDuplicate = apiCalls.length;
  assert.equal((await webhook.POST(signedRequest('transaction.success', { id: transactions[1] }))).status, 200);
  assert.equal(apiCalls.length, callsBeforeDuplicate);
  assert.equal(globalThis.__saspayAfter.length, 1);
  const secondRow = (await pg.query('SELECT status, saspay_payment_id FROM subscription_payments WHERE transaction_id = $1', [second.transactionId])).rows[0];
  assert.equal(secondRow.status, 'APPROVED');
  assert.equal(secondRow.saspay_payment_id, transactions[1]);

  // Webhook avec un montant incohérent : pas d'activation, réponse retentable.
  const third = await service.createSaspaySubscriptionPayment(USER, 'PRO', 'monthly', KEY);
  state[2].status = 'PAID';
  state[2].amount = '1.00';
  assert.equal((await webhook.POST(signedRequest('transaction.success', { id: transactions[2] }))).status, 503);
  assert.equal((await pg.query('SELECT status FROM subscription_payments WHERE transaction_id = $1', [third.transactionId])).rows[0].status, 'PENDING');
  await pg.query("UPDATE subscription_payments SET updated_at = '2020-01-01' WHERE transaction_id = $1", [third.transactionId]);
  assert.equal((await service.syncSaspaySubscriptions(KEY, USER)).errors, 1);
  const checked = (await pg.query('SELECT updated_at FROM subscription_payments WHERE transaction_id = $1', [third.transactionId])).rows[0].updated_at;
  assert.ok(new Date(checked).getUTCFullYear() > 2020);
  state[2].amount = '15000.00';
  const summary = await service.syncSaspaySubscriptions(KEY, USER);
  assert.equal(summary.activated, 1);
  assert.equal((await pg.query('SELECT status FROM subscription_payments WHERE transaction_id = $1', [third.transactionId])).rows[0].status, 'APPROVED');

  // Si la création a réussi à distance mais que la réponse a été perdue,
  // la facture reste en attente et le webhook peut retrouver son metadata.
  createFailure = 'network';
  await assert.rejects(service.createSaspaySubscriptionPayment(USER, 'PRO', 'monthly', KEY), /vérifiez votre abonnement/i);
  let orphan = (await pg.query('SELECT status, saspay_checkout_id FROM subscription_payments WHERE transaction_id = $1', [state[3].localTransactionId])).rows[0];
  assert.equal(orphan.status, 'PENDING');
  assert.equal(orphan.saspay_checkout_id, null);
  state[3].status = 'PAID';
  const recovered = await webhook.POST(signedRequest('transaction.success', { id: transactions[3] }));
  assert.equal(recovered.status, 200);
  assert.equal((await recovered.json()).status, 'approved');
  orphan = (await pg.query('SELECT status, saspay_checkout_id FROM subscription_payments WHERE transaction_id = $1', [state[3].localTransactionId])).rows[0];
  assert.equal(orphan.status, 'APPROVED');
  assert.equal(orphan.saspay_checkout_id, sessions[3]);

  // Un refus explicite n'est pas un résultat ambigu.
  createFailure = 422;
  await assert.rejects(service.createSaspaySubscriptionPayment(USER, 'PRO', 'monthly', KEY));
  const rejected = (await pg.query('SELECT status FROM subscription_payments WHERE transaction_id = $1', [state[4].localTransactionId])).rows[0];
  assert.equal(rejected.status, 'DECLINED');
});
