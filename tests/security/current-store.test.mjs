import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Résolution de la boutique courante — non-régression sur le contrôle d'accès.
 *
 * `resolveCurrentStoreId` a remplacé `getEffectiveStoreId`, qui posait jusqu'à
 * 4 requêtes par page. La nouvelle version lit le cookie puis le confronte à la
 * liste des boutiques déjà autorisées (propriétaire + équipe), sans requête.
 *
 * Le risque de cette optimisation est précisément de transformer un contrôle en
 * simple lecture : si la valeur du cookie était acceptée sans vérification, un
 * vendeur pourrait ouvrir la boutique d'un concurrent en forgeant un cookie.
 * Ces tests verrouillent ce comportement.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** Compile `src/lib/current-store.ts` avec ses frontières remplacées. */
async function loadResolver({ cookie, owned, staff, profile }) {
  const { build } = await import('esbuild');
  const { createRequire, Module } = await import('node:module');
  const require = createRequire(import.meta.url);

  const user = { id: 'user-1', email: 'vendeur@exemple.test' };

  const mocks = {
    'server-only': 'export {};',

    // Frontière 1 : la session (déjà chargée par le layout).
    '@/lib/request-cache': `
      export const getSessionUser = async () => (${JSON.stringify(user)});
      export async function getAccountAccess() {
        return {
          space: 'seller',
          profile: ${JSON.stringify(profile)},
          ownedStores: ${JSON.stringify(owned)},
          staffStores: ${JSON.stringify(staff)},
          staffEntries: ${JSON.stringify(
            staff.map((s) => ({ storeId: s.id, role: 'SELLER', permissions: null })),
          )},
        };
      }
    `,

    // Frontière 2 : le cookie, seule valeur fournie par le client.
    '@/utils/store-cookie': `
      export async function getStoreCookie() { return globalThis.__STORE_COOKIE__ ?? null; }
      export async function setStoreCookie() {}
      export async function clearStoreCookie() {}
    `,

    // Frontière 3 : la base, jamais atteinte pour un propriétaire.
    '@/db': `
      const chain = {
        select() { return chain; }, from() { return chain; }, where() { return chain; },
        limit() { return Promise.resolve([]); },
      };
      export const db = chain;
    `,
    '@/db/schema': 'export const storeStaff = {};',
    'drizzle-orm': `
      export const eq = () => ({});
      export const and = (...a) => ({ a });
      export const inArray = () => ({});
      export const desc = (a) => a;
      export const sql = () => ({});
    `,
  };

  const result = await build({
    entryPoints: [path.join(root, 'src/lib/current-store.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    packages: 'external',
    write: false,
    plugins: [
      {
        name: 'access-mocks',
        setup(plugin) {
          const contents = new Map(Object.entries(mocks));
          plugin.onLoad({ filter: /.*/, namespace: 'access-mock' }, (args) => ({
            contents: contents.get(args.path),
            loader: 'js',
          }));
          plugin.onResolve({ filter: /.*/ }, (args) => {
            if (contents.has(args.path)) return { path: args.path, namespace: 'access-mock' };
            if (args.path.startsWith('@/')) {
              return plugin.resolve(path.join(root, 'src', args.path.slice(2)), {
                resolveDir: root,
                kind: args.kind,
              });
            }
            return null;
          });
        },
      },
    ],
  });

  const mod = new Module('current-store');
  mod._compile(result.outputFiles[0].text, path.join(root, 'src/lib/current-store.ts'));

  globalThis.__STORE_COOKIE__ = cookie;
  return mod.exports;
}

const storeA = { id: 'store-A', createdAt: '2024-01-01T00:00:00.000Z' };
const storeB = { id: 'store-B', createdAt: '2024-02-01T00:00:00.000Z' };
const owner = { isSuperAdmin: false, avatarUrl: null, email: 'vendeur@exemple.test' };

test('boutique : le propriétaire retrouve sa boutique depuis le cookie', async () => {
  const { resolveCurrentStoreId } = await loadResolver({
    cookie: 'store-B',
    owned: [storeA, storeB],
    staff: [],
    profile: owner,
  });
  assert.equal(await resolveCurrentStoreId(), 'store-B');
});

test('boutique : un cookie vers une boutique non autorisée est IGNORÉ', async () => {
  const { resolveCurrentStoreId } = await loadResolver({
    cookie: 'store-du-voisin',
    owned: [storeA],
    staff: [],
    profile: owner,
  });
  // Le contrôle d'accès passe avant la valeur du client : repli sur la boutique
  // réellement possédée, jamais sur celle demandée.
  assert.equal(await resolveCurrentStoreId(), 'store-A');
});

test('boutique : un membre d’équipe accède à la boutique où il travaille', async () => {
  const { resolveCurrentStoreId } = await loadResolver({
    cookie: 'store-B',
    owned: [],
    staff: [storeB],
    profile: owner,
  });
  assert.equal(await resolveCurrentStoreId(), 'store-B');
});

test('boutique : un membre n’accède pas à une boutique où il ne travaille pas', async () => {
  const { resolveCurrentStoreId } = await loadResolver({
    cookie: 'store-A',
    owned: [],
    staff: [storeB],
    profile: owner,
  });
  assert.equal(await resolveCurrentStoreId(), 'store-B');
});

test('boutique : sans boutique, la résolution renvoie null', async () => {
  const { resolveCurrentStoreId } = await loadResolver({
    cookie: null,
    owned: [],
    staff: [],
    profile: owner,
  });
  assert.equal(await resolveCurrentStoreId(), null);
});

test('boutique : sans cookie, repli sur la plus ancienne boutique possédée', async () => {
  const { resolveCurrentStoreId } = await loadResolver({
    cookie: null,
    owned: [storeB, storeA], // ordre volontairement inversé
    staff: [],
    profile: owner,
  });
  assert.equal(await resolveCurrentStoreId(), 'store-A');
});

test('permissions : le propriétaire reçoit tous les droits sans lire la base', async () => {
  const { resolveStorePermissions } = await loadResolver({
    cookie: 'store-A',
    owned: [storeA],
    staff: [],
    profile: owner,
  });
  const full = { canManageProducts: true, canViewReports: true };
  const result = await resolveStorePermissions('store-A', full);
  assert.equal(result.role, 'OWNER');
  assert.deepEqual(result.permissions, full);
});

test('permissions : un non-membre n’obtient aucun droit', async () => {
  const { resolveStorePermissions } = await loadResolver({
    cookie: 'store-A',
    owned: [storeA],
    staff: [],
    profile: owner,
  });
  const result = await resolveStorePermissions('store-INCONNUE', { canManageProducts: true });
  assert.equal(result.role, 'SELLER');
  assert.deepEqual(result.permissions, {});
});

test('permissions : un membre SELLER ne voit pas les rapports par défaut', async () => {
  const { resolveStorePermissions } = await loadResolver({
    cookie: 'store-B',
    owned: [],
    staff: [storeB],
    profile: owner,
  });
  const full = { canManageProducts: true, canViewReports: true };
  // `permissions` est null en base : la règle par défaut s'applique.
  const result = await resolveStorePermissions('store-B', full);
  assert.equal(result.role, 'SELLER');
  assert.equal(result.permissions.canViewReports, false);
  assert.equal(result.permissions.canManageProducts, true);
});

test('permissions : le super administrateur a tous les droits', async () => {
  const { resolveStorePermissions } = await loadResolver({
    cookie: null,
    owned: [],
    staff: [],
    profile: { isSuperAdmin: true, avatarUrl: null, email: 'admin@exemple.test' },
  });
  const full = { canManageSettings: true };
  const result = await resolveStorePermissions('store-INCONNUE', full);
  assert.equal(result.role, 'OWNER');
  assert.deepEqual(result.permissions, full);
});
