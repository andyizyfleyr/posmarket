/**
 * Migration one-shot : copie toutes les données de l'ancien projet Neon
 * vers le nouveau. Idempotent (ON CONFLICT DO NOTHING sur les PK).
 *
 * Usage :
 *   OLD_DATABASE_URL=<ancienne> node --env-file=.env.local scripts/migrate-neon.mts
 *
 * (DATABASE_URL du .env.local = destination)
 */
import { neon, Client } from '@neondatabase/serverless';

const SRC = neon(process.env.OLD_DATABASE_URL!);
const DST = new Client({ connectionString: process.env.DATABASE_URL! });
await DST.connect();

// Ordre respectant les clés étrangères
const TABLES = [
  'profiles',
  'categories',
  'stores',
  'products',
  'customers',
  'coupons',
  'orders',
  'order_items',
  'invoices',
  'invoice_items',
  'product_reviews',
  'store_staff',
  'store_stats',
  'product_stats',
];

let totalRows = 0;

for (const table of TABLES) {
  const cols = (
    (await DST.query(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,
      [table]
    )).rows as any[]
  ).map((r) => r.column_name);
  if (cols.length === 0) {
    console.log(`⚠ ${table} : absente de la destination, ignorée`);
    continue;
  }
  const colList = cols.join(', ');
  const rows = (await SRC(`select ${colList} from ${table}`)) as any[];
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    await DST.query(
      `insert into ${table} (${colList}) values ${batch
        .map((_, j) => `(${cols.map((_, k) => `$${j * cols.length + k + 1}`).join(', ')})`)
        .join(', ')} on conflict do nothing`,
      batch.flatMap((r) => cols.map((c) => r[c] ?? null))
    );
    inserted += batch.length;
  }
  totalRows += rows.length;
  console.log(`${table.padEnd(16)} ${String(rows.length).padStart(5)} lignes`);
}

console.log(`\nMigration terminée : ${totalRows} lignes copiées.`);
