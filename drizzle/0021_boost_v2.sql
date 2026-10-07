-- V2 du panneau admin « Booster les statistiques » (/pam/stores/[id]).
--
-- boost_logs        : journal d'audit de chaque application (vues, commandes,
--                     avis, déboost) + base du quota journalier.
-- boost_schedules   : vues étalées sur une période, appliquées à l'ouverture
--                     du panneau (pas de cron).
-- *_boosted_views   : part des vues apportée par le boost, pour qu'un
--                     déboost ne ramène jamais le compteur sous la valeur
--                     réelle.
-- product_reviews.seller_reply : réponse du vendeur à l'avis.

CREATE TABLE IF NOT EXISTS "boost_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "action" text NOT NULL,
  "amount" integer DEFAULT 0 NOT NULL,
  "detail" jsonb DEFAULT '{}'::jsonb,
  "created_by" text,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "boost_logs_store_created_idx"
  ON "boost_logs" ("store_id", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "boost_schedules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE cascade,
  "scope" text DEFAULT 'store' NOT NULL,
  "product_id" uuid REFERENCES "products"("id") ON DELETE cascade,
  "total" integer DEFAULT 0 NOT NULL,
  "applied" integer DEFAULT 0 NOT NULL,
  "start_date" timestamp DEFAULT now() NOT NULL,
  "end_date" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "boost_schedules_store_idx" ON "boost_schedules" ("store_id");

ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "boosted_views" integer DEFAULT 0 NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "boosted_views" integer DEFAULT 0 NOT NULL;
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "seller_reply" text;
