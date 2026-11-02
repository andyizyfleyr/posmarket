import { PGlite } from '@electric-sql/pglite';
import { splitSqlStatements } from './scripts/lib/sql.mjs';
import fs from 'node:fs';

const db = await PGlite.create();
for (const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort()) {
  if (/^000[56]_/.test(f)) continue;
  for (const s of splitSqlStatements(fs.readFileSync('drizzle/'+f,'utf8')).filter(x=>x.trim())) {
    try { await db.exec(s); } catch {}
  }
}
const { rows } = await db.query(`select table_name, column_name from information_schema.columns where table_schema='public'`);
const cols = new Map();
for (const r of rows) { if (!cols.has(r.table_name)) cols.set(r.table_name, new Set()); cols.get(r.table_name).add(r.column_name); }

// Colonnes citées dans du SQL brut et dans schema.ts, par table
const files = [];
function walk(d){ for (const e of fs.readdirSync(d,{withFileTypes:true})) { const p=d+'/'+e.name; if(e.isDirectory()) walk(p); else if(/\.(ts|tsx)$/.test(e.name)) files.push(p); } }
walk('src');

const suspects=new Map();
for (const file of files) {
  const txt = fs.readFileSync(file,'utf8');
  // sql`...` template blocks
  for (const m of txt.matchAll(/sql`([\s\S]*?)`/g)) {
    const block=m[1];
    for (const t of cols.keys()) {
      const re = new RegExp(`(?:from|join|into|update|table)\\s+"?${t}"?\\s*`, 'i');
      if (!re.test(block)) continue;
      // colonnes utilisées dans des expressions type "x.column" ou column = ou insert lists
      for (const c of cols.get(t)) {
        const uses = new RegExp(`\\b${c}\\b`, 'i').test(block);
        if (!uses) continue;
      }
    }
  }
}
console.log('analyse terminée (heuristique)');
