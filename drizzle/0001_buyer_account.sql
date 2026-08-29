-- ============================================================================
-- 0001_buyer_account.sql
-- Espace acheteur (/mon-compte)
-- Ajoute le support des données utilisateur dans l'espace « Mon compte » :
--   * table buyer_addresses (adresses de livraison du client marketplace)
--   * ordres marketplace liés à un acheteur (buyer_user_id / buyer_email)
--   * avis produits liés à un profil (product_reviews.user_id)
-- Idempotent : peut être ré-appliqué sans danger.
-- ============================================================================

-- ---------------------------------------------------------------
-- 0. profiles : téléphone du profil acheteur (page paramètres)
-- ---------------------------------------------------------------
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "phone" text;

-- ---------------------------------------------------------------
-- 1. Table buyer_addresses
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "buyer_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"address" text NOT NULL,
	"city" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyer_addresses" ADD CONSTRAINT "buyer_addresses_user_id_profiles_id_fk"
	FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyer_addresses_user_id_idx" ON "buyer_addresses" ("user_id");

-- ---------------------------------------------------------------
-- 2. orders : colonnes acheteur marketplace
-- ---------------------------------------------------------------
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "buyer_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "buyer_email" text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_buyer_user_id_profiles_id_fk'
  ) THEN
    ALTER TABLE "orders" ADD CONSTRAINT "orders_buyer_user_id_profiles_id_fk"
      FOREIGN KEY ("buyer_user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_buyer_user_id_idx" ON "orders" ("buyer_user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "orders_buyer_email_idx" ON "orders" ("buyer_email");

-- ---------------------------------------------------------------
-- 3. product_reviews : lien vers le profil ayant publié l'avis
-- ---------------------------------------------------------------
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "user_id" uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_user_id_profiles_id_fk'
  ) THEN
    ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_profiles_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_reviews_user_id_idx" ON "product_reviews" ("user_id");