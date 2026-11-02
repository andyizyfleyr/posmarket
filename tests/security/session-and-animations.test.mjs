import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Lit un fichier source en normalisant les fins de ligne en LF.
 *
 * Sans cela, les tests qui découpent le contenu sur '\n' passent sous Linux et
 * échouent sous Windows : un checkout en CRLF (core.autocrlf=true, réglage par
 * défaut de Git for Windows) rend '\n}\n' introuvable, et `indexOf` renvoie -1.
 * Le code testé, lui, est identique — seul le test se cassait.
 */
function readSource(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

// ── Cookie de session PAM ──────────────────────────────────────────────────

/** Rejoue la validation de `getAdminSession` sans base de données. */
function validatePamToken(token, { secret, now, maxAgeSeconds }) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [id, issuedAt, signature] = parts;

  const issuedAtMs = Number(issuedAt);
  if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return null;
  const ageMs = now - issuedAtMs;
  if (ageMs < 0 || ageMs > maxAgeSeconds * 1000) return null;

  const expected = createHmac('sha256', secret).update(`${id}.${issuedAt}`).digest('hex');
  if (expected.length !== signature.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0 ? id : null;
}

const SECRET = 'x'.repeat(40);
const MAX_AGE = 8 * 60 * 60;

function makeToken(issuedAtMs, secret = SECRET) {
  const payload = `admin-1.${issuedAtMs}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

test('cookie PAM : un jeton frais et signé est accepté', () => {
  const now = 1_790_000_000_000;
  assert.equal(validatePamToken(makeToken(now), { secret: SECRET, now, maxAgeSeconds: MAX_AGE }), 'admin-1');
});

test('cookie PAM : un jeton expiré est refusé (régression : jamais vérifié)', () => {
  const now = 1_790_000_000_000;
  // Émis il y a 9 h alors que la session vaut 8 h.
  const expired = makeToken(now - 9 * 60 * 60 * 1000);
  assert.equal(validatePamToken(expired, { secret: SECRET, now, maxAgeSeconds: MAX_AGE }), null);
});

test('cookie PAM : un jeton antérieur à maintenant (horloge) est refusé', () => {
  const now = 1_790_000_000_000;
  const future = makeToken(now + 60_000);
  assert.equal(validatePamToken(future, { secret: SECRET, now, maxAgeSeconds: MAX_AGE }), null);
});

test('cookie PAM : une signature forgée sans le secret est refusée', () => {
  const now = 1_790_000_000_000;
  const forged = makeToken(now, 'mauvais-secret');
  assert.equal(validatePamToken(forged, { secret: SECRET, now, maxAgeSeconds: MAX_AGE }), null);
});

test('cookie PAM : l’horodatage signé ne peut pas être modifié', () => {
  const now = 1_790_000_000_000;
  const token = makeToken(now);
  const [id, issuedAt, signature] = token.split('.');
  const tampered = `${id}.${Number(issuedAt) + 1}.${signature}`;
  assert.equal(validatePamToken(tampered, { secret: SECRET, now, maxAgeSeconds: MAX_AGE }), null);
});

test('cookie PAM : le secret n’est jamais dérivé de DATABASE_URL', () => {
  const source = readSource('src/app/actions/admin-auth.ts');
  assert.equal(
    source.includes("update(process.env.DATABASE_URL"),
    false,
    'la clé de signature ne doit pas dépendre de la chaîne de connexion',
  );
  assert.ok(
    source.includes("process.env.NODE_ENV === 'production'"),
    'un secret absent doit être bloquant en production',
  );
  assert.ok(source.includes('MIN_SECRET_LENGTH'), 'une longueur minimale doit être imposée');
});

// ── Spinners ──────────────────────────────────────────────────────────────

const css = readSource('src/app/globals.css');

test('spinners : la règle « reduced motion » ne les fige plus', () => {
  const reduceBlock = css.slice(css.indexOf('prefers-reduced-motion: reduce'));
  const block = reduceBlock.slice(0, reduceBlock.indexOf('\n}\n') + 3);

  // L'ancien sélecteur universel imposait 0.01ms / 1 itération à TOUT,
  // y compris `.animate-spin` : un tour en 0,01 ms puis arrêt définitif.
  assert.ok(
    block.includes(':not(.animate-spin)'),
    'les spinners doivent être exclus de la remise à zéro globale',
  );
  assert.ok(
    block.includes('animation-duration: 1.5s !important'),
    'les spinners conservent une rotation lente au lieu de s’arrêter',
  );
  assert.ok(
    block.includes('animation-iteration-count: infinite !important'),
    'la rotation doit rester continue',
  );
});

test('spinners : une classe de sécurité force la rotation', () => {
  assert.ok(css.includes('.spinner-always'), 'classe de secours absente');
  const rule = css.slice(css.indexOf('.spinner-always'));
  assert.ok(rule.includes('animation: spin'), 'la classe doit rejouer l’animation spin');
  assert.ok(rule.includes('!important'), 'elle doit survivre à un `animation: none` hérité');
});

test('spinners : toutes les occurrences portent la classe de sécurité', () => {
  const files = [
    'src/components/Loader.tsx',
    'src/views/StorefrontView.tsx',
    'src/views/OrdersView.tsx',
    'src/views/InvoicesView.tsx',
    'src/views/SubscriptionView.tsx',
    'src/views/CustomersView.tsx',
    'src/views/ReportsView.tsx',
    'src/views/SettingsView.tsx',
    'src/components/buyer/NotificationsTab.tsx',
    'src/components/inventory/ImportProductsModal.tsx',
    'src/components/inventory/ExportProductImagesModal.tsx',
    'src/components/inventory/TransferProductsModal.tsx',
    'src/components/TransactionResultModal.tsx',
  ];
  const offenders = [];
  for (const file of files) {
    const source = readSource(file);
    const lines = source.split('\n');
    lines.forEach((line, index) => {
      if (!line.includes('animate-spin')) return;
      // Le composant Loader et sa documentation sont traités à part.
      if (file.endsWith('Loader.tsx')) return;
      if (!line.includes('spinner-always')) {
        offenders.push(`${file}:${index + 1}`);
      }
    });
  }
  assert.deepEqual(offenders, [], 'chaque spinner doit porter `spinner-always`');
});

// ── Migrations ────────────────────────────────────────────────────────────

test('migrations : chaque fichier SQL est référencé dans le journal', async () => {
  const { execFileSync } = await import('node:child_process');
  const output = execFileSync('node', ['scripts/check-migration-journal.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.ok(output.includes('cohérentes'), output);
});

test('migrations : orders.buyer_phone existe côté schéma ET migration', () => {
  const schema = readSource('src/db/schema.ts');
  assert.ok(schema.includes("buyerPhone: text('buyer_phone')"), 'colonne absente du schéma Drizzle');

  const migration = readSource('drizzle/0033_orders_buyer_phone.sql');
  assert.ok(migration.includes('buyer_phone'), 'colonne absente de la migration');
  assert.ok(migration.includes('IF NOT EXISTS'), 'la migration doit être rejouable');
});
