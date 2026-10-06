/**
 * Migration one-shot : variantes V2 (B1/B3)
 *
 * Usage : node scripts/apply-migration-0018-variant-v2.mjs
 *
 * `npm run db:migrate` (drizzle-kit) rejoue le journal depuis 0000 et casse
 * sur 0011 (0011_product_categories n'a pas de IF NOT EXISTS), parce que le
 * journal drizzle ne reflète que 5 des 20 migrations — les autres ont été
 * appliquées par des scripts SQL dédiés. On passe donc par runSqlFile comme
 * pour 0013 à 0017, qui est idempotent.
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DDL_FILE = 'drizzle/0018_variant_v2.sql';
await runSqlFile(sql, DDL_FILE);

const [tables] = await sql`
  SELECT count(*)::int AS total
  FROM information_schema.tables
  WHERE table_name IN ('product_variants', 'product_variant_snapshots')
`;
console.log('Tables variantes :', tables?.total ?? 0, '/ 2');
if ((tables?.total ?? 0) !== 2) {
  console.error('❌ Tables de variantes absentes après le DDL.');
  process.exit(1);
}

const [indexes] = await sql`
  SELECT count(*)::int AS total
  FROM pg_indexes
  WHERE tablename IN ('product_variants', 'product_variant_snapshots')
`;
console.log('Index :', indexes?.total ?? 0);

const [rows] = await sql`SELECT count(*)::int AS total FROM product_variants`;
const [withVariants] = await sql`
  SELECT count(*)::int AS total
  FROM products
  WHERE jsonb_typeof(variants) = 'array' AND jsonb_array_length(variants) > 0
`;
console.log(`Backfill : ${rows?.total} lignes relationnelles pour ${withVariants?.total} produit(s) à variantes.`);

console.log('\n✅ Variante V2 (B1/B3) appliquée.');