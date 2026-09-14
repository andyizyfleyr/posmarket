-- Migration: Robust Search Engine (pg_trgm + FTS)
-- Apply on Neon before deploying the new search action.

-- 1. Enable pg_trgm extension (trigram similarity)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Add tsvector generated column for Full-Text Search (French dictionary)
--    Combines product name (weight A) and description (weight B).
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "search_vector" tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('french', coalesce(name, '')), 'A') ||
      setweight(to_tsvector('french', coalesce(description, '')), 'B')
    ) STORED;

-- 3. GIN index on the tsvector column (fast @@ queries)
CREATE INDEX IF NOT EXISTS products_search_vector_gin_idx
  ON "products" USING gin ("search_vector");

-- 4. GIN trigram index on name (fast similarity / % queries, fuzzy typo matching)
CREATE INDEX IF NOT EXISTS products_name_trgm_gin_idx
  ON "products" USING gin ("name" gin_trgm_ops);

-- 5. GIN trigram index on description (wider fuzzy surface)
CREATE INDEX IF NOT EXISTS products_desc_trgm_gin_idx
  ON "products" USING gin ("description" gin_trgm_ops);
