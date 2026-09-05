-- Migration pour ajouter les colonnes B2B (company_name, ninea, wholesale_tiers)
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "company_name" text;
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "ninea" text;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_tiers" jsonb DEFAULT '[]'::jsonb;
