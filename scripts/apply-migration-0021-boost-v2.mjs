/**
 * Migration one-shot : V2 du panneau « Booster les statistiques ».
 *
 * Usage : node scripts/apply-migration-0021-boost-v2.mjs
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DDL_FILE = 'drizzle/0021_boost_v2.sql';
await runSqlFile(sql, DDL_FILE);

const tables = await sql`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_name IN ('boost_logs', 'boost_schedules')
`;
const cols = await sql`
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE (table_name = 'stores' AND column_name = 'boosted_views')
     OR (table_name = 'products' AND column_name = 'boosted_views')
     OR (table_name = 'product_reviews' AND column_name = 'seller_reply')
`;

if (!Array.isArray(tables) || tables.length !== 2) {
  console.error('❌ Tables boost_logs / boost_schedules absentes après le DDL :', tables);
  process.exit(1);
}
if (!Array.isArray(cols) || cols.length !== 3) {
  console.error('❌ Colonne(s) manquante(s) après le DDL :', cols);
  process.exit(1);
}

console.log('Tables prêtes :', tables.map((t) => t.table_name).join(', '));
console.log('Colonnes prêtes :', cols.map((c) => `${c.table_name}.${c.column_name}`).join(', '));
console.log('\n✅ V2 du boost en place.');
