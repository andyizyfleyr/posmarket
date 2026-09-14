// Verify migration 0005: check extension, column, and indexes exist on Neon
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL);

// 1. pg_trgm extension
const [extRow] = await sql`
  SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
`;
console.log('pg_trgm extension:', extRow ? '✅ installed' : '❌ MISSING');

// 2. search_vector column
const [colRow] = await sql`
  SELECT column_name, data_type, is_generated
  FROM information_schema.columns
  WHERE table_name = 'products' AND column_name = 'search_vector'
`;
console.log('search_vector column:', colRow
  ? `✅ exists (type: ${colRow.data_type}, generated: ${colRow.is_generated})`
  : '❌ MISSING');

// 3. GIN indexes
const indexes = await sql`
  SELECT indexname FROM pg_indexes
  WHERE tablename = 'products'
    AND indexname IN (
      'products_search_vector_gin_idx',
      'products_name_trgm_gin_idx',
      'products_desc_trgm_gin_idx'
    )
`;
const found = new Set(indexes.map(r => r.indexname));
for (const idx of ['products_search_vector_gin_idx','products_name_trgm_gin_idx','products_desc_trgm_gin_idx']) {
  console.log(`  Index ${idx}:`, found.has(idx) ? '✅' : '❌ MISSING');
}

// 4. Quick search smoke test
const results = await sql`
  SELECT id, name,
    ts_rank(search_vector, websearch_to_tsquery('french', 'test')) AS rank,
    similarity(name, 'test') AS sim
  FROM products
  WHERE is_online = true
  LIMIT 3
`;
console.log(`\nSmoke test (3 products sample): ${results.length > 0 ? '✅ query OK' : '⚠️ no products'}`);
if (results.length > 0) {
  results.forEach(r => console.log(`  - "${r.name}" rank=${Number(r.rank).toFixed(4)} sim=${Number(r.sim).toFixed(4)}`));
}
