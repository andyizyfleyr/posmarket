#!/usr/bin/env node
/**
 * Applique les migrations manquantes à la base pointée par `DATABASE_URL`.
 *
 * Utilité : la limitation de débit distribuée (`api_rate_limits`), les jetons
 * push (`push_tokens`, `guest_push_tokens`) et le suivi des commandes invitées
 * (`orders.buyer_phone`) sont livrés dans le code mais **ne fonctionnent pas
 * tant que leur migration n'est pas jouée**. Ce script ne joue QUE les
 * migrations absentes, contrairement à `npm run db:migrate` qui rejoue le
 * journal depuis 0000.
 *
 * Détection : pour chaque migration à partir de `0025`, on vérifie la présence
 * de son objet principal (table, colonne ou index) dans `information_schema`.
 * Une migration déjà appliquée n'est donc jamais rejouée.
 *
 * Usage :
 *   DATABASE_URL="postgresql://…" node scripts/apply-pending-migrations.mjs
 *   node scripts/apply-pending-migrations.mjs --dry-run   # liste seulement
 *
 * Le script lit aussi `.env.local` s'il existe (même logique que
 * `scripts/apply-migration.mjs`), et accepte `DIRECT_URL` en repli.
 */
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './lib/sql.mjs';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !(match[1] in process.env)) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

const dryRun = process.argv.includes('--dry-run');
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
 * comme déjà appliquée. Volontairement indépendant du journal Drizzle, car les
 * migrations de ce dépôt ont longtemps été jouées à la main
 * (`scripts/apply-migration-*.mjs`).
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

const sql = neon(url);

let pending = 0;
let applied = 0;

for (const migration of MIGRATIONS) {
  const filePath = path.resolve('drizzle', migration.file);
  if (!fs.existsSync(filePath)) {
    console.error(`✗ fichier introuvable : ${migration.file}`);
    process.exit(1);
  }

  const { rows } = await sql(migration.probe);
  if (rows.length > 0) {
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
    await sql([statement]);
  }
  applied += 1;
  console.log(`✔ ${migration.file} appliquée (${statements.length} instruction(s))`);
}

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
