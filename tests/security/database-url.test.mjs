/**
 * Normalisation de DATABASE_URL.
 *
 * Incident réel : la variable d'environnement de production contenait la
 * commande shell complète —
 *
 *   psql 'postgresql://user:pass@host/db?sslmode=require&channel_binding=require'
 *
 * `neon()` la rejette (« not a valid URL »), donc chaque page qui lit la base
 * répondait 500 alors que la variable « existait ». Ces tests figent le
 * comportement attendu du nettoyage.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');

/** Charge le module TS via esbuild, sans passer par le bundle Next. */
async function loadModule() {
  const result = await build({
    entryPoints: [path.join(root, 'src', 'lib', 'database-url.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
  });
  const code = result.outputFiles[0].text;
  const dataUrl = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  return import(dataUrl);
}

const { normalizeDatabaseUrl, describeDatabaseUrlProblem } = await loadModule();

const HOST = 'ep-billowing-snow-aye011mg-pooler.c-5.us-east-2.aws.neon.tech';
const PASSWORD = 'npg_tbna5MTwFR7D';
const RAW = `psql 'postgresql://neondb_owner:${PASSWORD}@${HOST}/neondb?sslmode=require&channel_binding=require'`;

test('retire le préfixe psql et les guillemets', () => {
  const url = new URL(normalizeDatabaseUrl(RAW));
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, HOST);
  assert.equal(url.username, 'neondb_owner');
  assert.equal(url.pathname, '/neondb');
});

test('le mot de passe est préservé à l’identique', () => {
  assert.equal(new URL(normalizeDatabaseUrl(RAW)).password, PASSWORD);
});

test('sslmode est conservé', () => {
  assert.equal(new URL(normalizeDatabaseUrl(RAW)).searchParams.get('sslmode'), 'require');
});

test('channel_binding est retiré (incompatible avec les pilotes utilisés)', () => {
  assert.equal(normalizeDatabaseUrl(RAW).includes('channel_binding'), false);
});

test('accepte une URL déjà propre, sans la modifier', () => {
  const clean = `postgresql://user:pass@${HOST}/neondb?sslmode=require`;
  assert.equal(normalizeDatabaseUrl(clean), clean);
});

test('accepte les guillemets doubles et les espaces autour', () => {
  const url = normalizeDatabaseUrl(`  "postgresql://user:pass@${HOST}/db"  `);
  assert.equal(new URL(url).hostname, HOST);
});

test('convertit l’alias postgres:// en postgresql://', () => {
  assert.ok(normalizeDatabaseUrl(`postgres://user:pass@${HOST}/db`).startsWith('postgresql://'));
});

test('chaîne absente ou vide → chaîne vide (pas de throw)', () => {
  assert.equal(normalizeDatabaseUrl(undefined), '');
  assert.equal(normalizeDatabaseUrl('   '), '');
});

test('describeDatabaseUrlProblem explique le copier-coller sans fuiter le secret', () => {
  const message = describeDatabaseUrlProblem(RAW);
  // Le nettoyage rend l'URL exploitable : plus de problème signalé.
  assert.equal(message, null);

  // Le cas non réparable (pas une URL du tout) donne un message utile…
  const broken = describeDatabaseUrlProblem("psql 'pas-une-url'");
  assert.match(broken, /commande shell|URL/);
  // …et ne divulgue jamais le mot de passe.
  assert.equal(String(broken).includes(PASSWORD), false);
});

test('describeDatabaseUrlProblem signale une variable absente', () => {
  assert.match(describeDatabaseUrlProblem(''), /absente/);
});

test('le code applicatif utilise bien la normalisation (non-régression)', () => {
  const source = fs.readFileSync(path.join(root, 'src', 'db', 'index.ts'), 'utf8');
  assert.match(source, /normalizeDatabaseUrl/);
  assert.match(source, /describeDatabaseUrlProblem/);
});
