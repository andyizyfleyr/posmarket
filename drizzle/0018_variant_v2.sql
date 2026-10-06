-- Variantes V2 : table relationnelle + historique gelé (B1 / B3).
-- `products.variants` (JSONB) reste la source de lecture du storefront ; la
-- table relationnelle est synchronisée à chaque enregistrement produit et
-- sert d'index / contrainte / historique pour la V2.

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "name" text,
  "option_values" jsonb DEFAULT '{}'::jsonb,
  "price" numeric(12, 2) DEFAULT '0',
  "stock" integer DEFAULT 0 NOT NULL,
  "sku" text,
  "image" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "product_variants_product_id_idx" ON "product_variants" ("product_id");

CREATE TABLE IF NOT EXISTS "product_variant_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "options" jsonb DEFAULT '[]'::jsonb,
  "variants" jsonb DEFAULT '[]'::jsonb,
  "reason" text,
  "created_by" text DEFAULT 'system',
  "created_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "product_variant_snapshots_product_id_idx" ON "product_variant_snapshots" ("product_id");

-- Backfill initial : hydrate la table relationnelle depuis le JSONB existant.
INSERT INTO "product_variants" (
  "product_id", "name", "option_values", "price", "stock", "sku", "image", "enabled"
)
SELECT
  p."id",
  v->>'name',
  COALESCE(v->'optionValues', '{}'::jsonb),
  COALESCE((v->>'price')::numeric, 0),
  COALESCE((v->>'stock')::integer, 0),
  v->>'sku',
  v->>'image',
  COALESCE((v->>'enabled')::boolean, true)
FROM "products" p, jsonb_array_elements(
  CASE WHEN jsonb_typeof(p."variants") = 'array' THEN p."variants" ELSE '[]'::jsonb END
) AS v
ON CONFLICT DO NOTHING;