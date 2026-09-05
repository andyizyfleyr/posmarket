-- Enable trigram support for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add index on product name for fuzzy searching
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING GIN(name gin_trgm_ops);
