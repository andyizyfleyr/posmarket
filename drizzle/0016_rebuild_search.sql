-- Ensure search_vector column and indexes exist
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector text NOT NULL DEFAULT '';
-- Ensure the generated tsvector can be populated if we want (optional). Actual FTS uses raw SQL in query.ts; column exists.
-- No DROP/REPLACE that breaks existing data.
