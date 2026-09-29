/**
 * Migration one-shot : déduplication des soumissions de commande
 *
 * Usage : node scripts/apply-migration-0013-checkout-idempotency.mjs
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DDL_FILE = 'drizzle/0013_checkout_idempotency.sql';
await runSqlFile(sql, DDL_FILE);

const [table] = await sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'checkout_idempotency'
  ORDER BY column_name
`;

if (!table) {
  console.error('❌ Table "checkout_idempotency" absente après le DDL.');
  process.exit(1);
}
console.log('Table prête : checkout_idempotency');

const [indexes] = await sql`
  SELECT count(*)::int AS total
  FROM pg_indexes
  WHERE tablename = 'checkout_idempotency'
`;
console.log('Index :', indexes?.total ?? 0);

const [stale] = await sql`
  DELETE FROM "checkout_idempotency"
  WHERE "created_at" < now() - interval '24 hours'
  RETURNING key
`;
console.log('Clés expirées purgées :', Array.isArray(stale) ? stale.length : 0);

console.log('\n✅ Déduplication des commandes activée.');
