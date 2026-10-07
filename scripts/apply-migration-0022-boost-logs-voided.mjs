/**
 * Migration one-shot : quota 24 h rendu après un « Débooster ».
 *
 * Usage : node scripts/apply-migration-0022-boost-logs-voided.mjs
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DDL_FILE = 'drizzle/0022_boost_logs_voided.sql';
await runSqlFile(sql, DDL_FILE);

const cols = await sql`
  SELECT column_name, column_default, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'boost_logs' AND column_name = 'voided'
`;

if (!Array.isArray(cols) || cols.length !== 1) {
  console.error('❌ Colonne boost_logs.voided absente après le DDL :', cols);
  process.exit(1);
}

console.log('Colonne prête : boost_logs.voided');
console.log('\n✅ Quota 24 h rendu par le déboost en place.');
