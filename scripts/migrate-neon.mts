/**
 * Copie les données de la base Neon ACTUELLE vers la NOUVELLE base,
 * table par table, dans un ordre compatible avec les clés étrangères
 * (tri topologique : les tables parentes sont copiées en premier).
 *
 * Idempotent : ON CONFLICT DO NOTHING — rejouable sans risque.
 * Ne touche PAS au schéma (les tables doivent déjà exister sur la cible ;
 * appliquer le schéma d'abord avec `DATABASE_URL=<nouvelle> npm run db:migrate`).
 *
 * Usage :
 *   OLD_DATABASE_URL=<ancienne url> node --env-file=.env.local --import tsx scripts/migrate-neon.mts
 *   OLD_DATABASE_URL=<ancienne url> node --import tsx scripts/migrate-neon.mts --verify-only
 *
 * `DATABASE_URL` provient du .env.local : elle doit pointer sur la NOUVELLE base.
 * `OLD_DATABASE_URL` sur l'ANCIENNE. (Si le fichier .env.local est absent,
 * exportez simplement les deux variables dans votre terminal.)
 */
import { Client } from 'pg';

try {
  // dotenv n'est pas une dépendance déclarée mais drizzle.config.ts l'utilise :
  // on le charge s'il est là (permet --env-file moins souvent obligatoire).
  const dotenv = await import('dotenv');
  dotenv.config({ path: '.env.local' });
} catch {
  /* env exportées manuellement, c'est bon */
}

const OLD_URL = process.env.OLD_DATABASE_URL;
const NEW_URL = process.env.DATABASE_URL;
const VERIFY_ONLY = process.argv.includes('--verify-only');

if (!OLD_URL || !NEW_URL) {
  console.error('✘  OLD_DATABASE_URL (ancienne) ou DATABASE_URL (nouvelle) manquante pour .env.local');
  process.exit(1);
}

const clientOpts = (connectionString: string) => ({
  connectionString,
  // Neon exige TLS ; le paramètre sslmode de la chaîne suffit normalement,
  // ce rejet ignoré reste un filet de sécurité harmalless hors Neon.
  ssl: { rejectUnauthorized: false },
});

const src = new Client(clientOpts(OLD_URL));
const dst = new Client(clientOpts(NEW_URL));

/** Retourne la liste des tables `public` (hors journal Drizzle) d'une base. */
async function listTables(client: Client): Promise<string[]> {
  const { rows } = await client.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      order by table_name`,
  );
  return rows
    .map((r) => r.table_name)
    .filter((t) => !t.startsWith('__drizzle') && t !== 'schema_migrations');
}

/** Colonnes (dans l'ordre) + type de chaque colonne, pour une table. */
async function listColumns(
  client: Client,
  table: string,
): Promise<{ name: string; udt: string }[]> {
  const { rows } = await client.query<{ column_name: string; udt_name: string }>(
    `select column_name, udt_name from information_schema.columns
      where table_schema = 'public' and table_name = $1
      order by ordinal_position`,
    [table],
  );
  return rows.map((r) => ({ name: r.column_name, udt: r.udt_name }));
}

/** Graphe des dépendances FK du schéma public : parent -> [enfants]. */
async function fkGraph(client: Client): Promise<{ parents: Map<string, Set<string>>; children: Map<string, Set<string>> }> {
  const { rows } = await client.query<{ child: string; parent: string }>(
    `select conrelid::regclass::text as child, confrelid::regclass::text as parent
       from pg_constraint
      where contype = 'f' and connamespace = 'public'::regnamespace`,
  );
  const parents = new Map<string, Set<string>>();
  const children = new Map<string, Set<string>>();
  for (const { child, parent } of rows) {
    if (child === parent) continue; // auto-référence : gérable en un seul INSERT multi-lignes
    if (!parents.has(parent)) parents.set(parent, new Set());
    parents.get(parent)!.add(child);
    if (!children.has(child)) children.set(child, new Set());
    children.get(child)!.add(parent);
  }
  return { parents, children };
}

/** Tri topologique (Kahn) : parents avant enfants. Lève si cycle inter-tables. */
function topoSort(tables: string[], children: Map<string, Set<string>>): string[] {
  const incoming = new Map<string, number>();
  const adj = new Map<string, Set<string>>();
  for (const t of tables) {
    const deps = [...(children.get(t) ?? [])].filter((d) => tables.includes(d));
    incoming.set(t, deps.length);
    for (const d of deps) {
      if (!adj.has(d)) adj.set(d, new Set());
      adj.get(d)!.add(t);
    }
  }
  const queue = tables.filter((t) => incoming.get(t) === 0);
  const order: string[] = [];
  while (queue.length) {
    const t = queue.shift()!;
    order.push(t);
    for (const nxt of adj.get(t) ?? []) {
      incoming.set(nxt, incoming.get(nxt)! - 1);
      if (incoming.get(nxt) === 0) queue.push(nxt);
    }
  }
  if (order.length !== tables.length) {
    const rest = tables.filter((t) => !order.includes(t));
    throw new Error(
      `Cycle de clés étrangères entre : ${rest.join(', ')}. ` +
        'Impossible de copier sans désactiver les contraintes — signalez-le.',
    );
  }
  return order;
}

/** Échappe un élément de tableau PostgreSQL. */
function pgEscapeArrayElem(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  const s = String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${s}"`;
}

/** Formate une valeur JS pour l'insertion (selon le type PG cible). */
function formatValue(v: unknown, udt: string): unknown {
  if (v === undefined || v === null) return null;
  if (udt === 'jsonb' || udt === 'json') return JSON.stringify(v);
  if (udt.startsWith('_')) {
    // Type tableau PostgreSQL (udt = '_' + type de base)
    if (Array.isArray(v)) return `{${v.map(pgEscapeArrayElem).join(',')}}`;
    return String(v);
  }
  return v;
}

async function main() {
  await src.connect();
  await dst.connect();

  const [{ pretty: oldSize }] = (
    await src.query<{ pretty: string }>(`select pg_size_pretty(pg_database_size(current_database())) as pretty`)
  ).rows;
  console.log(`Ancienne base : ${oldSize}`);

  const oldTables = await listTables(src);
  const newTables = new Set(await listTables(dst));
  const missing = oldTables.filter((t) => !newTables.has(t));
  if (missing.length) {
    console.error(`✘  Tables ABSENTES sur la nouvelle base : ${missing.join(', ')}`);
    console.error('   Appliquez d’abord le schéma : DATABASE_URL=<nouvelle url> npm run db:migrate');
    process.exit(1);
  }

  const { children } = await fkGraph(src);
  const order = topoSort(oldTables, children);
  console.log(`${order.length} tables à copier\n`);

  let failures = 0;
  const summary: { table: string; srcRows: number; done?: boolean }[] = [];

  for (const table of order) {
    const cols = await listColumns(src, table);
    if (!cols.length) continue;
    const colList = cols.map((c) => `"${c.name}"`).join(', ');

    if (VERIFY_ONLY) {
      const [a, b] = await Promise.all([
        src.query<{ c: string }>(`select count(*)::text as c from "${table}"`),
        dst.query<{ c: string }>(`select count(*)::text as c from "${table}"`),
      ]);
      const nA = Number(a.rows[0].c);
      const nB = Number(b.rows[0].c);
      const ok = nA === nB;
      if (!ok) failures++;
      summary.push({ table, srcRows: nA });
      console.log(`${ok ? '✓' : '✘'} ${table.padEnd(28)} ${nA} → ${nB}`);
      continue;
    }

    const { rows } = await src.query(`select ${colList} from "${table}"`);
    if (!rows.length) {
      console.log(`· ${table.padEnd(28)} 0 ligne`);
      summary.push({ table, srcRows: 0, done: true });
      continue;
    }

    await dst.query('begin');
    try {
      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const params: unknown[] = [];
        const valuesSql = batch
          .map(
            (_, j) =>
              `(${cols.map((_, k) => `$${j * cols.length + k + 1}`).join(', ')})`,
          )
          .join(', ');
        for (const row of batch) {
          for (const c of cols) params.push(formatValue(row[c.name], c.udt));
        }
        await dst.query(
          `insert into "${table}" (${colList}) values ${valuesSql} on conflict do nothing`,
          params,
        );
      }
      await dst.query('commit');
    } catch (err) {
      await dst.query('rollback');
      failures++;
      console.error(`✘ ${table}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    summary.push({ table, srcRows: rows.length, done: true });
    console.log(`✓ ${table.padEnd(28)} ${rows.length} lignes`);
  }

  const total = summary.reduce((acc, s) => acc + s.srcRows, 0);
  console.log(`\n${VERIFY_ONLY ? 'Vérification' : 'Copie'} terminée : ${total} lignes, ${failures} échec(s).`);

  await src.end();
  await dst.end();

  if (failures > 0) process.exit(1);
}

main().catch((err) => {
  console.error('✘ ', err instanceof Error ? err.message : err);
  process.exit(1);
});
