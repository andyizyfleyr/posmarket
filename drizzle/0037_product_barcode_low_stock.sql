-- Code-barres produit (scan au POS) et seuil d'alerte de stock bas par produit.
-- Idempotente : chaque instruction est rejouable sans erreur.
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold integer;
CREATE INDEX IF NOT EXISTS products_barcode_idx ON products (barcode) WHERE barcode IS NOT NULL;
