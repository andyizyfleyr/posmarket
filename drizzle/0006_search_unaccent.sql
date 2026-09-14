-- Migration 0006: unaccent + accent-insensitive search_vector
-- NOTE: unaccent() is STABLE (not IMMUTABLE) by default, which prevents its
-- use in GENERATED ALWAYS AS columns. The workaround is to create an
-- IMMUTABLE wrapper function that delegates to unaccent().

-- 1. Enable unaccent extension
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2. Create an IMMUTABLE wrapper so it can be used in generated columns
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
  RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT public.unaccent($1);
$$;

-- 3. Rebuild search_vector using the immutable wrapper
ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector";

ALTER TABLE "products"
  ADD COLUMN "search_vector" tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('french', immutable_unaccent(coalesce(name, ''))), 'A') ||
      setweight(to_tsvector('french', immutable_unaccent(coalesce(description, ''))), 'B')
    ) STORED;

-- 4. Rebuild GIN index
DROP INDEX IF EXISTS products_search_vector_gin_idx;
CREATE INDEX products_search_vector_gin_idx
  ON "products" USING gin ("search_vector");
