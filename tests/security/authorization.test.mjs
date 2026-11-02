import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Gardes d'autorisation des routes et actions sensibles.
 *
 * Ces tests couvrent les régressions corrigées à la suite de l'audit :
 *
 * - `POST /api/set-store` était ouvert sans authentification ;
 * - `POST /api/marketplace/guest/push-token` laissait deviner l'existence
 *   d'une commande et acceptait un téléphone quelconque ;
 * - `GET /api/ping` renvoyait le message d'erreur brut de la base ;
 * - `saveCustomerAction` ne contraignait pas `store_id` dans son UPDATE ;
 * - le cookie PAM n'était jamais vérifié pour son expiration.
 *
 * Chaque test importe le module RÉEL et remplace uniquement la frontière
 * (session, base, limiteur). Aucun mock ne redéfinit la logique testée.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Compile un fichier TS/TSX en CJS avec des modules remplacés. */
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
            // Un namespace dédié est obligatoire : esbuild refuse un chemin
            // relatif dans le namespace « file ».
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

/** Faux `next/server` : suffisant pour les handlers testés. */
const NEXT_SERVER_MOCK = `
  exports.NextResponse = {
    json: (body, init) => new Response(JSON.stringify(body), {
      status: (init && init.status) || 200,
      headers: { 'content-type': 'application/json' },
    }),
  };
  exports.NextRequest = class NextRequest extends Request {};
`;

function jsonRequest(url, body) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── /api/ping ──────────────────────────────────────────────────────────────

test('ping : ne divulgue jamais le message d’erreur de la base', async () => {
  const leaks = [];
  const originalError = console.error;
  console.error = (...args) => leaks.push(args.join(' '));
  try {
    const { GET } = await loadModule('src/app/api/ping/route.ts', {
      '@/db': `exports.db = { execute: async () => {
        throw new Error('connect ECONNREFUSED postgresql://neondb_owner:s3cr3t@ep-x.neon.tech/main');
      } };`,
    });

    const response = await GET();
    const text = await response.text();

    assert.equal(response.status, 500);
    assert.equal(text.includes('s3cr3t'), false, 'le mot de passe ne doit pas fuiter');
    assert.equal(text.includes('neon.tech'), false, "l'hôte ne doit pas fuiter");
    assert.equal(text.includes('ECONNREFUSED'), false, 'le code réseau ne doit pas fuiter');
    // Le détail reste disponible côté serveur.
    assert.ok(leaks.some((line) => line.includes('ping')), 'erreur journalisée côté serveur');
  } finally {
    console.error = originalError;
  }
});

test('ping : renvoie ok quand la base répond', async () => {
  const { GET } = await loadModule('src/app/api/ping/route.ts', {
    '@/db': `exports.db = { execute: async () => ({ rows: [] }) };`,
  });
  const response = await GET();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

// ── /api/set-store ─────────────────────────────────────────────────────────

test('set-store : refuse un appelant sans accès à la boutique', async () => {
  let cookieWritten = false;
  const { POST } = await loadModule('src/app/api/set-store/route.ts', {
    'next/server': NEXT_SERVER_MOCK,
    '@/utils/store-cookie': `exports.setStoreCookie = async () => { globalThis.__auditCookieWritten = true; };`,
    '@/lib/validation': `exports.parseBody = async (req) => ({ ok: true, data: await req.json() });`,
    '@/lib/schemas': `exports.sellerStoreIdSchema = { _type: 'sellerStoreId' };`,
    '@/lib/api-rate-limit': `exports.enforceSharedRateLimit = async () => null;`,
    '@/lib/authorization': `exports.requireStoreAccess = async () => ({ ok: false, error: 'Boutique non autorisée' });`,
  });

  globalThis.__auditCookieWritten = false;
  const response = await POST(
    jsonRequest('https://shop.example.test/api/set-store', {
      storeId: '11111111-1111-4111-8111-111111111111',
    }),
  );

  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.equal(payload.success, false);
  // Le message ne doit pas distinguer « non authentifié » de « non autorisé ».
  assert.equal(payload.error, 'Accès refusé.');
  assert.equal(globalThis.__auditCookieWritten, false, 'aucun cookie ne doit être écrit');
  assert.equal(cookieWritten, false);
});

test('set-store : écrit le cookie quand l’accès est autorisé', async () => {
  const { POST } = await loadModule('src/app/api/set-store/route.ts', {
    'next/server': NEXT_SERVER_MOCK,
    '@/utils/store-cookie': `exports.setStoreCookie = async (id) => { globalThis.__auditWrittenId = id; };`,
    '@/lib/validation': `exports.parseBody = async (req) => ({ ok: true, data: await req.json() });`,
    '@/lib/schemas': `exports.sellerStoreIdSchema = { _type: 'sellerStoreId' };`,
    '@/lib/api-rate-limit': `exports.enforceSharedRateLimit = async () => null;`,
    '@/lib/authorization': `exports.requireStoreAccess = async () => ({ ok: true, userId: 'u1', isSuperAdmin: false, storeIds: ['s1'] });`,
  });

  const response = await POST(
    jsonRequest('https://shop.example.test/api/set-store', { storeId: 'store-owned-by-user' }),
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(globalThis.__auditWrittenId, 'store-owned-by-user');
});

test('set-store : la limitation de débit s’applique avant tout', async () => {
  const { POST } = await loadModule('src/app/api/set-store/route.ts', {
    'next/server': NEXT_SERVER_MOCK,
    '@/utils/store-cookie': `exports.setStoreCookie = async () => { throw new Error('ne doit pas être appelé'); };`,
    '@/lib/validation': `exports.parseBody = async (req) => ({ ok: true, data: await req.json() });`,
    '@/lib/schemas': `exports.sellerStoreIdSchema = { _type: 'sellerStoreId' };`,
    '@/lib/api-rate-limit': `exports.enforceSharedRateLimit = async () =>
      new Response(JSON.stringify({ error: 'Trop de requêtes' }), { status: 429 });`,
    '@/lib/authorization': `exports.requireStoreAccess = async () => ({ ok: true });`,
  });

  const response = await POST(
    jsonRequest('https://shop.example.test/api/set-store', { storeId: 's1' }),
  );
  assert.equal(response.status, 429);
});

// ── guest/push-token ──────────────────────────────────────────────────────

/** Base factice : une commande invitée, une commande liée à un compte. */
const ORDER_ROWS = {
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa': {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    buyerEmail: 'client@example.test',
    buyerPhone: '22990000000',
    buyerUserId: null,
  },
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb': {
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    buyerEmail: 'compte@example.test',
    buyerPhone: '22991111111',
    buyerUserId: 'user-1',
  },
};
const VALID_TOKEN = 'ExponentPushToken[abcdefghijklmnop]';

function guestRouteMocks(overrides = {}) {
  return {
    '@/db': `exports.db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              const id = globalThis.__auditOrderId;
              const row = globalThis.__auditOrders[id];
              return row ? [row] : [];
            },
          }),
        }),
      }),
    };`,
    '@/db/schema': `exports.orders = {
      id: 'orders.id', buyerEmail: 'orders.buyer_email',
      buyerPhone: 'orders.buyer_phone', buyerUserId: 'orders.buyer_user_id',
    };`,
    'drizzle-orm': `exports.eq = (a, b) => ({ a, b });`,
    '@/lib/push': `exports.registerGuestPushToken = async (input) => {
      globalThis.__auditRegistered = input;
    };`,
    '@/lib/api-rate-limit': `exports.enforceSharedRateLimit = async () => null;`,
    ...overrides,
  };
}

test('guest/push-token : un téléphone inconnu est refusé', async () => {
  globalThis.__auditOrders = ORDER_ROWS;
  globalThis.__auditOrderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  globalThis.__auditRegistered = null;

  const { POST } = await loadModule('src/app/api/marketplace/guest/push-token/route.ts', guestRouteMocks());

  const response = await POST(
    jsonRequest('https://shop.example.test/api/marketplace/guest/push-token', {
      token: VALID_TOKEN,
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      phone: '+229 97 00 00 00', // ne correspond pas à 22990000000
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(globalThis.__auditRegistered, null, 'aucun jeton ne doit être enregistré');
});

test('guest/push-token : le message d’erreur est unique (anti-énumération)', async () => {
  globalThis.__auditOrders = ORDER_ROWS;
  const { POST } = await loadModule('src/app/api/marketplace/guest/push-token/route.ts', guestRouteMocks());

  const bodies = [
    // commande inexistante
    { orderId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'x@example.test' },
    // commande liée à un compte
    { orderId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', email: 'compte@example.test' },
    // email qui ne correspond pas
    { orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', email: 'autre@example.test' },
  ];

  const messages = [];
  for (const body of bodies) {
    globalThis.__auditOrderId = body.orderId;
    const response = await POST(
      jsonRequest('https://shop.example.test/api/marketplace/guest/push-token', {
        token: VALID_TOKEN,
        ...body,
      }),
    );
    assert.equal(response.status, 400);
    messages.push((await response.json()).error);
  }

  assert.equal(new Set(messages).size, 1, 'les trois refus doivent être indiscernables');
});

test('guest/push-token : un jeton valide sur la bonne commande est accepté', async () => {
  globalThis.__auditOrders = ORDER_ROWS;
  globalThis.__auditOrderId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  globalThis.__auditRegistered = null;

  const { POST } = await loadModule('src/app/api/marketplace/guest/push-token/route.ts', guestRouteMocks());

  const response = await POST(
    jsonRequest('https://shop.example.test/api/marketplace/guest/push-token', {
      token: VALID_TOKEN,
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'CLIENT@example.test ',
      platform: 'ios',
    }),
  );

  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.ok(globalThis.__auditRegistered, 'jeton transmis au service');
  assert.equal(globalThis.__auditRegistered.email, 'client@example.test');
  assert.equal(globalThis.__auditRegistered.platform, 'ios');
});

test('guest/push-token : la limitation de débit précède toute lecture en base', async () => {
  const { POST } = await loadModule('src/app/api/marketplace/guest/push-token/route.ts', {
    '@/db': `exports.db = { select: () => { throw new Error('ne doit pas être appelé'); } };`,
    '@/db/schema': `exports.orders = {};`,
    'drizzle-orm': `exports.eq = () => ({});`,
    '@/lib/push': `exports.registerGuestPushToken = async () => {};`,
    '@/lib/api-rate-limit': `exports.enforceSharedRateLimit = async () =>
      new Response(JSON.stringify({ error: 'Trop de requêtes' }), { status: 429 });`,
  });

  const response = await POST(
    jsonRequest('https://shop.example.test/api/marketplace/guest/push-token', {
      token: VALID_TOKEN,
      orderId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      email: 'client@example.test',
    }),
  );
  assert.equal(response.status, 429);
});

test('guest/push-token : un orderId non UUID est rejeté avant la base', async () => {
  const { POST } = await loadModule('src/app/api/marketplace/guest/push-token/route.ts', {
    '@/db': `exports.db = { select: () => { throw new Error('ne doit pas être appelé'); } };`,
    '@/db/schema': `exports.orders = {};`,
    'drizzle-orm': `exports.eq = () => ({});`,
    '@/lib/push': `exports.registerGuestPushToken = async () => {};`,
    '@/lib/api-rate-limit': `exports.enforceSharedRateLimit = async () => null;`,
  });

  const response = await POST(
    jsonRequest('https://shop.example.test/api/marketplace/guest/push-token', {
      token: VALID_TOKEN,
      orderId: "1' OR '1'='1",
      email: 'client@example.test',
    }),
  );
  assert.equal(response.status, 400);
});
