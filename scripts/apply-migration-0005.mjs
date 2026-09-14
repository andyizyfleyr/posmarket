// Script: apply migration 0005_search_engine.sql directly via Neon driver
// Run: node scripts/apply-migration-0005.mjs

import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = neon(process.env.DATABASE_URL);

const migration = readFileSync(
  join(__dirname, '..', 'drizzle', '0005_search_engine.sql'),
  'utf8'
);

// Split statements: use semicolons as delimiters, strip comments
const statements = migration
  .split(';')
  .map(s => s.replace(/--[^\n]*/g, '').trim())
  .filter(s => s.length > 0);

console.log(`Applying ${statements.length} statement(s) to Neon...\n`);

for (const stmt of statements) {
  const preview = stmt.split('\n').find(l => l.trim()).trim();
  console.log('▶', preview);
  try {
    // neon() returns a tagged template function — use it with a raw string
    await sql([stmt]);   // pass as array of strings (raw template literal trick)
    console.log('  ✅ OK\n');
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes('already exists')) {
      console.log('  ⚠️  Already exists — skipped\n');
    } else {
      console.error('  ❌ ERROR:', msg, '\n');
      process.exit(1);
    }
  }
}

console.log('✅ Migration 0005 applied successfully.');
