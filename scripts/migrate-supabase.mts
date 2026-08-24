/**
 * Migration one-shot : Supabase (REST/PostgREST) -> Neon nouveau projet.
 * Copie l'intersection des colonnes présentes des deux côtés ; pagination
 * automatique côté PostgREST. Idempotent (ON CONFLICT DO NOTHING).
 *
 * Usage : SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node --env-file=.env.local scripts/migrate-supabase.mts
 */
import { neon, Client } from '@neondatabase/serverless';

const SB = process.env.SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_KEY!;
const DST = new Client({ connectionString: process.env.DATABASE_URL! });
await DST.connect();

const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// Ordre FK
const TABLES = [
  'profiles',
  'stores',
  'categories',
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

async function fetchAll(table: string): Promise<Record<string, any>[]> {
  const out: Record<string, any>[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const res = await fetch(
      `${SB}/rest/v1/${table}?select=*&limit=${pageSize}&offset=${offset}`,
      { headers: HEADERS }
    );
    if (!res.ok) {
      const t = await res.text();
      if (res.status === 404) return out;
      throw new Error(`${table}: ${res.status} ${t.slice(0, 120)}`);
    }
    const rows = (await res.json()) as Record<string, any>[];
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
}

// Renommages de colonnes source -> destination + valeurs calculées
const COLUMN_MAP: Record<string, Record<string, string>> = {
  order_items: { price: 'unit_price' },
};

function normalize(table: string, rows: Record<string, any>[]): Record<string, any>[] {
  const map = COLUMN_MAP[table];
  if (!map) return rows;
  for (const r of rows) {
    for (const [from, to] of Object.entries(map)) {
      if (r[to] == null && r[from] != null) r[to] = r[from];
    }
    if (table === 'order_items' && r.total == null && r.unit_price != null && r.quantity != null) {
      r.total = String(Number(r.unit_price) * Number(r.quantity));
    }
  }
  return rows;
}

let totalRows = 0;

for (const table of TABLES) {
  const dstCols = (
    (await DST.query(
      `select column_name from information_schema.columns where table_schema='public' and table_name=$1 order by ordinal_position`,
      [table]
    )).rows as any[]
  ).map((r) => r.column_name);
  if (dstCols.length === 0) {
    console.log(`⚠ ${table} : absente de la destination`);
    continue;
  }

  let rows: Record<string, any>[];
  try {
    rows = await fetchAll(table);
  } catch (e: any) {
    console.log(`⚠ ${table} : ${e.message}`);
    continue;
  }
  if (rows.length === 0) {
    console.log(`— ${table.padEnd(16)} vide côté source`);
    continue;
  }
  normalize(table, rows);

  const srcColsSet = new Set(rows.flatMap((r) => Object.keys(r)));
  const cols = dstCols.filter((c: string) => srcColsSet.has(c));
  const colList = cols.join(', ');

  for (let i = 0; i < rows.length; i += 25) {
    const batch = rows.slice(i, i + 25);
    await DST.query(
      `insert into ${table} (${colList}) values ${batch
        .map((_, j) => `(${cols.map((_, k) => `$${j * cols.length + k + 1}`).join(', ')})`)
        .join(', ')} on conflict do nothing`,
      batch.flatMap((r) => cols.map((c) => r[c] ?? null))
    );
  }
  totalRows += rows.length;
  console.log(`✓ ${table.padEnd(16)} ${String(rows.length).padStart(5)} lignes (${cols.length} colonnes)`);
}

console.log(`\nMigration terminée : ${totalRows} lignes.`);
await DST.end();
