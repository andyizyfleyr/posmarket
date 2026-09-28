-- Migration : taxonomie produit globale (gestion admin)
-- Table `categories` existante = categories par boutique (store_id NOT NULL),
-- inutilisee par l'application. On ajoute donc une table globale unique,
-- hierarchisee via parent_id (2 niveaux max) et ordonnee via `position`.

CREATE TABLE IF NOT EXISTS "product_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "icon" text,
  "parent_id" uuid,
  "business_type" text DEFAULT 'shopping' NOT NULL,
  "position" integer DEFAULT 0 NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "product_categories_name_unique" UNIQUE("name"),
  CONSTRAINT "product_categories_slug_unique" UNIQUE("slug")
);

CREATE INDEX IF NOT EXISTS "product_categories_parent_id_idx" ON "product_categories" ("parent_id");
CREATE INDEX IF NOT EXISTS "product_categories_position_idx" ON "product_categories" ("position");

-- Rejouable : le script d'application ignore l'erreur "already exists".
ALTER TABLE "product_categories"
  ADD CONSTRAINT "product_categories_parent_id_fk"
  FOREIGN KEY ("parent_id") REFERENCES "product_categories"("id")
  ON DELETE SET NULL;
