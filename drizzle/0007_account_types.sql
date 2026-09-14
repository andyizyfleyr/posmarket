-- 0007_account_types.sql
-- Distinct account_type for buyer, seller, admin to prevent mixing accounts
ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "account_type" text DEFAULT 'buyer';

UPDATE "profiles"
SET "account_type" = 'seller'
WHERE "id" IN (SELECT DISTINCT "user_id" FROM "stores")
   OR "id" IN (SELECT DISTINCT "user_id" FROM "store_staff");

UPDATE "profiles"
SET "account_type" = 'admin'
WHERE "is_super_admin" = true;
