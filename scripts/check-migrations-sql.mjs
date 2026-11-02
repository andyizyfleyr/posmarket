#!/usr/bin/env node
/**
 * Rejoue toutes les migrations `drizzle/*.sql` sur un PostgreSQL jetable
 * (PGlite, WASM — aucune connexion réseau, aucun identifiant requis).
 *
 * Objectif : détecter une migration qui ne s'exécute pas AVANT de la jouer sur
 * la base de production. Deux classes de défauts déjà rencontrées ici :
 *
 * 1. **Dialecte** : `DO  BEGIN` au lieu de `DO $$ BEGIN` (0014) — PostgreSQL
 *    refuse la syntaxe, et comme le reste du fichier est alors ignoré, des
 *    colonnes manquent silencieusement.
 * 2. **Ordre** : une migration qui touche une table créée plus tard (0009
 *    modifiait `notification_outbox`, créée par 0015 → échec en base neuve).
 *
 * Les extensions `pg_trgm` / `unaccent` sont attendues en production (Neon) mais
 * absentes de PGlite : les fichiers qui les installent sont signalés et ignorés.
 *
 * Usage : `node scripts/check-migrations-sql.mjs`
 *         `npm run db:check:sql`
 */
import fs from 'node:fs';
import path from 'node:path';
import { splitSqlStatements } from './lib/sql.mjs';

const root = path.resolve(import.meta.dirname, '..');
const drizzleDir = path.join(root, 'drizzle');

/**
 * Fichiers dont l'échec est attendu en l'absence des extensions contrib.
 * La production Neon les a ; le contrôle les saute volontairement.
 */
const REQUIRES_EXTENSIONS = new Set(['0005_search_engine', '0006_search_unaccent']);

async function loadPglite() {
  try {
    const mod = await import('@electric-sql/pglite');
    return mod.PGlite;
  } catch {
    return null;
  }
}

const PGlite = await loadPglite();
if (!PGlite) {
  console.error(
    '✗ @electric-sql/pglite est absent. Installez-le : npm i -D @electric-sql/pglite',
  );
  process.exit(1);
}

const files = fs
  .readdirSync(drizzleDir)
  .filter((file) => file.endsWith('.sql'))
  .sort();

const db = await PGlite.create();

let applied = 0;
const failures = [];

for (const file of files) {
  const tag = file.slice(0, -4);
  if (REQUIRES_EXTENSIONS.has(tag)) {
    console.log(`↷ ${file} (extensions contrib, vérifié sur Neon)`);
    continue;
  }

  const statements = splitSqlStatements(
    fs.readFileSync(path.join(drizzleDir, file), 'utf8'),
  ).filter((statement) => statement.trim());

  for (const [index, statement] of statements.entries()) {
    try {
      await db.exec(statement);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const ignorable = /already exists|duplicate key/i.test(message);
      if (!ignorable) {
        failures.push(
          `${file} (statement ${index + 1}) : ${message.split('\n')[0]}`,
        );
      }
      break;
    }
  }
  applied += 1;
}

/** Tables/vues que le code applicatif interroge et qui doivent exister. */
const REQUIRED_OBJECTS = [
  { kind: 'table', name: 'api_rate_limits' },
  { kind: 'table', name: 'push_tokens' },
  { kind: 'table', name: 'guest_push_tokens' },
  { kind: 'table', name: 'review_authors' },
  { kind: 'table', name: 'boost_logs' },
  { kind: 'column', table: 'orders', name: 'buyer_phone' },
  { kind: 'column', table: 'orders', name: 'boosted' },
  { kind: 'column', table: 'product_reviews', name: 'author_avatar' },
];

const missing = [];
for (const object of REQUIRED_OBJECTS) {
  const query =
    object.kind === 'table'
      ? `SELECT 1 FROM information_schema.tables WHERE table_name = '${object.name}'`
      : `SELECT 1 FROM information_schema.columns WHERE table_name = '${object.table}' AND column_name = '${object.name}'`;
  const { rows } = await db.query(query);
  if (rows.length === 0) missing.push(object.name);
}

/**
 * 3. **Schéma incomplet** : chaque table `pgTable(...)` de `src/db/schema.ts`
 *    doit exister après rejeu. Une migration oubliée se voit ici, pas en
 *    production (erreur « relation does not exist » à la première requête).
 */
const schemaSource = fs.readFileSync(path.join(root, 'src', 'db', 'schema.ts'), 'utf8');
const declaredTables = [...schemaSource.matchAll(/pgTable\(\s*'([a-z0-9_]+)'/g)].map(
  (match) => match[1],
);
const { rows: tableRows } = await db.query(
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
);
const createdTables = new Set(tableRows.map((row) => row.table_name));
const missingTables = declaredTables.filter((table) => !createdTables.has(table));

await db.close();

if (failures.length > 0 || missing.length > 0 || missingTables.length > 0) {
  if (failures.length > 0) {
    console.error(`✗ ${failures.length} migration(s) en échec :`);
    for (const failure of failures) console.error(`  - ${failure}`);
  }
  if (missing.length > 0) {
    console.error(`✗ objets absents après migration : ${missing.join(', ')}`);
  }
  if (missingTables.length > 0) {
    console.error(`✗ tables déclarées sans migration : ${missingTables.join(', ')}`);
  }
  process.exit(1);
}

console.log(
  `✓ ${applied} migrations rejouées sans erreur — ${declaredTables.length} tables du schéma présentes, ${REQUIRED_OBJECTS.length} objets applicatifs vérifiés.`,
);
