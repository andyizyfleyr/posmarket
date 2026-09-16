#!/usr/bin/env node
// Applique une migration SQL manuelle (drizzle/*.sql) à la base Neon.
// Usage:
//   node scripts/apply-migration.mjs drizzle/0008_fedapay_subscriptions.sql
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/apply-migration.mjs <drizzle/xxxx_name.sql>');
    process.exit(1);
  }
  const sqlText = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL introuvable dans .env.local');
    process.exit(1);
  }
  const sql = neon(url);
  const statements = sqlText
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  for (const stmt of statements) {
    await sql(stmt);
  }
  console.log(`✔ Migration appliquée : ${file} (${statements.length} statement(s))`);
}

main().catch((e) => {
  console.error('Erreur:', e.message || e);
  process.exit(1);
});