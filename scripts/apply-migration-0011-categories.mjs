/**
 * Migration one-shot : taxonomie produit globale + seed depuis src/constants.ts
 *
 * Usage : node scripts/apply-migration-0011-categories.mjs
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DDL_FILE = 'drizzle/0011_product_categories.sql';
const SEED_FILE = 'drizzle/0011_product_categories_seed.sql';

// 1. DDL (CREATE TABLE IF NOT EXISTS + index + FK) : replayable sans risque.
await runSqlFile(sql, DDL_FILE);

const [table] = await sql`
  SELECT to_regclass('public.product_categories') AS reg
`;
if (!table?.reg) {
  console.error('❌ La table product_categories est toujours absente après le DDL.');
  process.exit(1);
}

const [before] = await sql`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE parent_id IS NULL)::int AS roots
  FROM "product_categories"
`;
console.log('\nAvant :', before);

// 2. Seed depuis les constantes historiques (idempotent via ON CONFLICT).
await runSqlFile(sql, SEED_FILE);

const [after] = await sql`
  SELECT
    count(*)::int AS total,
    count(*) FILTER (WHERE parent_id IS NULL)::int AS roots,
    count(*) FILTER (WHERE parent_id IS NOT NULL)::int AS children,
    count(*) FILTER (WHERE NOT is_active)::int AS inactive
  FROM "product_categories"
`;
console.log('\nApres :', after);

const [fk] = await sql`
  SELECT conname FROM pg_constraint WHERE conname = 'product_categories_parent_id_fk'
`;
console.log('FK parent_id:', fk?.conname ? '✅' : '❌ MANQUANTE');

console.log('\n✅ Taxonomie produit appliquee.');
