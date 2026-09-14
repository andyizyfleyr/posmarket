import { neon } from '@neondatabase/serverless';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

// Execute each DDL statement directly (avoids dollar-quote parsing issues)
const steps = [
  {
    label: 'CREATE EXTENSION unaccent',
    stmt: `CREATE EXTENSION IF NOT EXISTS unaccent`,
  },
  {
    label: 'CREATE immutable_unaccent() wrapper',
    // Use a plain SQL function body to avoid dollar-quote parsing issues
    stmt: `CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
RETURN public.unaccent($1)`,
  },
  {
    label: 'DROP old search_vector column',
    stmt: `ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector"`,
  },
  {
    label: 'ADD search_vector (unaccent + GENERATED STORED)',
    stmt: `ALTER TABLE "products"
  ADD COLUMN "search_vector" tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('french', immutable_unaccent(coalesce(name, ''))), 'A') ||
      setweight(to_tsvector('french', immutable_unaccent(coalesce(description, ''))), 'B')
    ) STORED`,
  },
  {
    label: 'DROP old GIN index',
    stmt: `DROP INDEX IF EXISTS products_search_vector_gin_idx`,
  },
  {
    label: 'CREATE GIN index on search_vector',
    stmt: `CREATE INDEX products_search_vector_gin_idx ON "products" USING gin ("search_vector")`,
  },
];

console.log(`Applying ${steps.length} steps to Neon...\n`);

for (const { label, stmt } of steps) {
  console.log('▶', label);
  try {
    await sql([stmt]);
    console.log('  ✅ OK\n');
  } catch (err) {
    const msg = err?.message || String(err);
    if (msg.includes('already exists') || msg.includes('does not exist')) {
      console.log('  ⚠️ Skipped:', msg.split('\n')[0], '\n');
    } else {
      console.error('  ❌ ERROR:', msg, '\n');
      process.exit(1);
    }
  }
}

// Verify
const [ext] = await sql`SELECT extname FROM pg_extension WHERE extname = 'unaccent'`;
console.log('unaccent extension:', ext ? '✅' : '❌ MISSING');

const [col] = await sql`
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'products' AND column_name = 'search_vector'
`;
console.log('search_vector column:', col ? '✅ rebuilt' : '❌ MISSING');

const [fnRow] = await sql`SELECT immutable_unaccent('café écharpe') AS result`;
console.log('immutable_unaccent("café écharpe"):', fnRow?.result);

console.log('\n✅ Migration 0006 applied successfully.');
