/**
 * Migration one-shot : marqueurs des données boostées (admin).
 *
 * Usage : node scripts/apply-migration-0019-boost-flags.mjs
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DDL_FILE = 'drizzle/0019_boost_flags.sql';
await runSqlFile(sql, DDL_FILE);

const cols = await sql`
  SELECT table_name, column_name, column_default, is_nullable
  FROM information_schema.columns
  WHERE (table_name = 'orders' AND column_name = 'boosted')
     OR (table_name = 'product_reviews' AND column_name = 'boosted')
  ORDER BY table_name
`;

if (!Array.isArray(cols) || cols.length !== 2) {
  console.error('❌ Colonne(s) "boosted" absente(s) après le DDL :', cols);
  process.exit(1);
}
for (const c of cols) {
  if (c.is_nullable !== 'NO') {
    console.error(`❌ ${c.table_name}.boosted devrait être NOT NULL.`);
    process.exit(1);
  }
  console.log(`Colonne prête : ${c.table_name}.boosted (défaut ${c.column_default})`);
}

const [stats] = await sql`
  SELECT
    (SELECT count(*)::int FROM "orders" WHERE boosted)::int   AS orders_boosted,
    (SELECT count(*)::int FROM "orders")::int                AS orders_total,
    (SELECT count(*)::int FROM "product_reviews" WHERE boosted)::int AS reviews_boosted,
    (SELECT count(*)::int FROM "product_reviews")::int       AS reviews_total
`;
console.log('Commandes boostées :', stats.orders_boosted, '/', stats.orders_total);
console.log('Avis boostés :', stats.reviews_boosted, '/', stats.reviews_total);

console.log('\n✅ Marqueurs "boosted" en place.');
