-- Variantes V2 : table relationnelle + historique gelé (B1 / B3).
-- `products.variants` (JSONB) reste la source de lecture du storefront ; la
-- table relationnelle est synchronisée à chaque enregistrement produit et
-- sert d'index / contrainte / historique pour la V2.

CREATE TABLE IF NOT EXISTS "product_variants" (
  -- `id` = id de la variante dans le JSONB `products.variants` (text et non
  -- uuid : `newVariantId()` peut sortir un id non-uuid sans crypto.randomUUID).
  -- PK composite : deux produits peuvent porter le même id de variante, et le
  -- préfixe `product_id` indexe déjà les recherches par produit.
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "name" text,
  "option_values" jsonb DEFAULT '{}'::jsonb,
  "price" numeric(12, 2) DEFAULT '0',
  "stock" integer DEFAULT 0 NOT NULL,
  "sku" text,
  "image" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "product_variants_pk" PRIMARY KEY ("product_id", "id")
);

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
-- Idempotent (ON CONFLICT + NOT EXISTS) : relancer le script ne duplique rien.
INSERT INTO "product_variants" (
  "id", "product_id", "name", "option_values", "price", "stock", "sku", "image", "enabled", "sort_order"
)
SELECT
  COALESCE(v.value->>'id', gen_random_uuid()::text),
  p."id",
  v.value->>'name',
  COALESCE(v.value->'optionValues', '{}'::jsonb),
  COALESCE((v.value->>'price')::numeric, 0),
  COALESCE((v.value->>'stock')::integer, 0),
  v.value->>'sku',
  v.value->>'image',
  COALESCE((v.value->>'enabled')::boolean, true),
  v.ord::int
FROM "products" p
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(p."variants") = 'array' THEN p."variants" ELSE '[]'::jsonb END
) WITH ORDINALITY AS v(value, ord)
WHERE NOT EXISTS (
  SELECT 1 FROM "product_variants" existing WHERE existing."product_id" = p."id"
)
ON CONFLICT DO NOTHING;