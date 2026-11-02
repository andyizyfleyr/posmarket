import { PGlite } from '@electric-sql/pglite';
import { splitSqlStatements } from './scripts/lib/sql.mjs';
import fs from 'node:fs';

const db = await PGlite.create();
for (const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
  if (/^000[56]_/.test(f)) continue; // extensions contrib
  for (const s of splitSqlStatements(fs.readFileSync('drizzle/'+f,'utf8')).filter(x=>x.trim())) {
    try { await db.exec(s); } catch (e) { console.log('ECHEC', f, String(e.message).slice(0,80)); }
  }
}
const { rows } = await db.query(`
  select table_name, column_name from information_schema.columns where table_schema='public'
`);
const live = new Map();
for (const r of rows) {
  if (!live.has(r.table_name)) live.set(r.table_name, new Set());
  live.get(r.table_name).add(r.column_name);
}

// Parse schema.ts
const src = fs.readFileSync('src/db/schema.ts','utf8');
const blocks = [...src.matchAll(/export const (\w+) = pgTable\(\s*'([a-z0-9_]+)'\s*,\s*\{([\s\S]*?)\n\}/g)];
const missing = [];
for (const [, varName, table, body] of blocks) {
  const cols = [...body.matchAll(/^\s{2}(\w+):\s*\w+\(\s*'([a-z0-9_]+)'/gm)].map(m=>m[2]);
  const have = live.get(table);
  if (!have) { missing.push(`TABLE ABSENTE: ${table}`); continue; }
  for (const c of cols) if (!have.has(c)) missing.push(`${table}.${c}`);
}
console.log('tables analysées:', blocks.length);
console.log('colonnes manquantes:', missing.length);
missing.slice(0,40).forEach(m=>console.log(' -', m));
