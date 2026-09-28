-- 0012_order_item_variants.sql
-- La commande doit pouvoir dire QUELLE variante a été achetée.
-- Les variantes vivent dans `products.variants` (JSONB) : on fige donc un
-- instantané (libellé, SKU, options, nom et image du produit) afin que
-- l'historique reste lisible même si le produit est renommé, modifié ou supprimé.

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_id" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_label" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_sku" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "variant_option_values" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_name" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_unit" text;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "product_image" text;

-- Recherche des commandes d'une variante précise (retour en stock, réassort).
CREATE INDEX IF NOT EXISTS "order_items_variant_id_idx" ON "order_items" ("variant_id");
CREATE INDEX IF NOT EXISTS "order_items_product_id_idx" ON "order_items" ("product_id");
