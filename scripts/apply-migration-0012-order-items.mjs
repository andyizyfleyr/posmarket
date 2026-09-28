/**
 * Migration one-shot : instantané de variante sur les lignes de commande
 *
 * Usage : node scripts/apply-migration-0012-order-items.mjs
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const DDL_FILE = 'drizzle/0012_order_item_variants.sql';
const CLEANUP_FILE = 'drizzle/0012_variants_json_cleanup.sql';
await runSqlFile(sql, DDL_FILE);
await runSqlFile(sql, CLEANUP_FILE);

const rows = await sql`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_name = 'order_items'
    AND column_name IN (
      'variant_id', 'variant_label', 'variant_sku', 'variant_option_values',
      'product_name', 'product_unit', 'product_image'
    )
  ORDER BY column_name
`;

console.log('\nColonnes ajoutées :', rows.map((r) => r.column_name).join(', ') || 'aucune');
const missing = 7 - rows.length;
if (missing > 0) {
  console.error(`❌ ${missing} colonne(s) manquante(s) après le DDL.`);
  process.exit(1);
}

const [shapes] = await sql`
  SELECT jsonb_typeof(COALESCE(variants, '[]'::jsonb))::text AS shape, count(*)::int AS total
  FROM "products"
  GROUP BY 1
`;
console.log('Forme du champ variants :', shapes);

const [productSkus] = await sql`
  SELECT count(*)::int AS total
  FROM "products"
  WHERE CASE
          WHEN jsonb_typeof(variants) = 'array' THEN jsonb_array_length(variants)
          ELSE 0
        END > 0
`;
console.log('Produits avec variantes :', productSkus?.total ?? 0);

console.log('\n✅ Variantes figées sur les commandes.');
