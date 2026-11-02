#!/usr/bin/env node
/**
 * Applique à la base les migrations manquantes, et rien d'autre.
 *
 * Contexte : plusieurs fonctionnalités livrées dans le code restent inertes
 * tant que leur migration n'est pas jouée —
 *
 *   - `api_rate_limits`      → limitation de débit partagée entre instances
 *   - `push_tokens`          → notifications vendeur
 *   - `guest_push_tokens`    → suivi des commandes invitées
 *   - `orders.buyer_phone`   → vérification du téléphone au checkout
 *
 * et `npm run db:migrate` ne convient pas : il rejoue le journal Drizzle depuis
 * 0000, alors que ces migrations ont longtemps été appliquées à la main.
 *
 * Ce script sonde `information_schema` pour chaque objet attendu et ne joue que
 * les fichiers réellement absents. Il est donc idempotent et sans risque sur
 * une base déjà à jour.
 *
 * Deux transports, choisis automatiquement :
 *
 *   1. `@neondatabase/serverless` (HTTPS) — le seul possible depuis Vercel.
 *   2. `pg` (TCP + TLS) — nécessaire en local et depuis GitHub Actions :
 *      `*.tech` sur Neon n'expose pas l'endpoint HTTP.
 *
 * Usage :
 *   DATABASE_URL="postgresql://…" node scripts/apply-pending-migrations.mjs
 *   DATABASE_URL="postgresql://…" node scripts/apply-pending-migrations.mjs --dry-run
 *   node scripts/apply-pending-migrations.mjs --force-pg   # forcer TCP/TLS
 *
 * Le script lit aussi `.env.local` s'il existe, et accepte `DIRECT_URL` (chaîne
 * non poolée) en repli — préférable pour du DDL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { splitSqlStatements } from './lib/sql.mjs';

/**
 * Lit `.env.local` puis `.env` (premier gagnant).
 *
 * `.env.local` reste prioritaire : c'est la convention Next.js. `.env` est
 * accepté en repli pour les machines où l'on garde une seule configuration.
 */
function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.resolve(process.cwd(), name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !(match[1] in process.env)) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

loadEnv();

const dryRun = process.argv.includes('--dry-run');
const forcePg = process.argv.includes('--force-pg');
const url = process.env.DATABASE_URL || process.env.DIRECT_URL;

if (!url) {
  console.error(
    '✗ DATABASE_URL (ou DIRECT_URL) est requis.\n' +
      '  Exemple : DATABASE_URL="postgresql://user:pass@host/db" node scripts/apply-pending-migrations.mjs',
  );
  process.exit(1);
}

/**
 * Objet témoin de chaque migration : s'il existe, la migration est considérée
 * comme déjà appliquée. On ne se fie pas au journal Drizzle, puisque ces
 * fichiers ont été joués hors journal.
 */
const MIGRATIONS = [
  {
    file: '0025_saspay_subscriptions.sql',
    describe: 'subscription_payments.saspay_checkout_id',
    probe: `SELECT 1 FROM information_schema.columns
            WHERE table_name = 'subscription_payments' AND column_name = 'saspay_checkout_id'`,
  },
  {
    file: '0026_boost_flags.sql',
    describe: 'orders.boosted',
    probe: `SELECT 1 FROM information_schema.columns
            WHERE table_name = 'orders' AND column_name = 'boosted'`,
  },
  {
    file: '0027_review_authors.sql',
    describe: 'table review_authors',
    probe: `SELECT 1 FROM information_schema.tables WHERE table_name = 'review_authors'`,
  },
  {
    file: '0028_boost_v2.sql',
    describe: 'table boost_logs',
    probe: `SELECT 1 FROM information_schema.tables WHERE table_name = 'boost_logs'`,
  },
  {
    file: '0029_boost_logs_voided.sql',
    describe: 'boost_logs.voided',
    probe: `SELECT 1 FROM information_schema.columns
            WHERE table_name = 'boost_logs' AND column_name = 'voided'`,
  },
  {
    file: '0030_api_rate_limits.sql',
    describe: 'table api_rate_limits',
    probe: `SELECT 1 FROM information_schema.tables WHERE table_name = 'api_rate_limits'`,
  },
  {
    file: '0031_push_tokens.sql',
    describe: 'table push_tokens',
    probe: `SELECT 1 FROM information_schema.tables WHERE table_name = 'push_tokens'`,
  },
  {
    file: '0032_guest_push_tokens.sql',
    describe: 'table guest_push_tokens',
    probe: `SELECT 1 FROM information_schema.tables WHERE table_name = 'guest_push_tokens'`,
  },
  {
    file: '0033_orders_buyer_phone.sql',
    describe: 'orders.buyer_phone',
    probe: `SELECT 1 FROM information_schema.columns
            WHERE table_name = 'orders' AND column_name = 'buyer_phone'`,
  },
];

/**
 * Fabrique un exécuteur `run(sqlText) → lignes`.
 *
 * - `pg` : une seule connexion pour tout le script (DDL + plusieurs
 *   instructions dans la même session, comme un `psql -f`).
 * - Neon serverless : une requête HTTP par instruction ; on ne peut pas y
 *   ouvrir de transaction longue, mais nos migrations sont idempotentes.
 */
async function makeRunner() {
  if (!forcePg) {
    try {
      const { neon } = await import('@neondatabase/serverless');
      const neonSql = neon(url);
      // Sonde : si l'endpoint HTTP n'est pas disponible (base `.tech`), on
      // bascule sur TCP plutôt que d'échouer avec « fetch failed ».
      await neonSql`select 1 as ok`;
      console.log('• transport : Neon serverless (HTTPS)');
      return async (statement) => {
        const result = await neonSql(statement);
        return Array.isArray(result) ? result : [];
      };
    } catch (error) {
      console.log(
        `• transport HTTPS indisponible (${error?.message?.slice(0, 60) || 'échec'}) → bascule sur TCP/TLS`,
      );
    }
  }

  const pg = (await import('pg')).default;
  const client = new pg.Client({
    connectionString: url,
    // Neon impose TLS ; le certificat est signé par une AC publique, mais on
    // ne durcit pas la vérification ici : le but est de faire passer du DDL
    // depuis un environnement dont on ne maîtrise pas le magasin d'AC.
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  console.log('• transport : pg (TCP + TLS)');
  return async (statement) => {
    const result = await client.query(statement);
    return result.rows || [];
  };
}

let runner;
try {
  runner = await makeRunner();
} catch (error) {
  console.error('✗ connexion impossible :', error?.message || error);
  process.exit(1);
}

let applied = 0;
let pending = 0;

for (const migration of MIGRATIONS) {
  const filePath = path.resolve('drizzle', migration.file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ fichier introuvable : ${migration.file}`);
    process.exit(1);
  }

  const existing = await runner(migration.probe);
  if (existing.length > 0) {
    console.log(`= ${migration.file} — déjà appliquée (${migration.describe})`);
    continue;
  }

  pending += 1;
  if (dryRun) {
    console.log(`→ ${migration.file} — À APPLIQUER (${migration.describe})`);
    continue;
  }

  const statements = splitSqlStatements(fs.readFileSync(filePath, 'utf8')).filter((statement) =>
    statement.trim(),
  );
  for (const statement of statements) {
    await runner(statement);
  }
  applied += 1;
  console.log(`✔ ${migration.file} appliquée (${statements.length} instruction(s))`);
}

if (typeof runner.close === 'function') await runner.close();

if (dryRun) {
  console.log(
    pending === 0
      ? '✓ Base à jour : aucune migration à appliquer.'
      : `→ ${pending} migration(s) à appliquer.`,
  );
} else {
  console.log(
    applied === 0
      ? '✓ Base à jour : aucune migration à appliquer.'
      : `✓ ${applied} migration(s) appliquée(s).`,
  );
}
