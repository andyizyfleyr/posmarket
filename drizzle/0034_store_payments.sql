-- Moyens de paiement propres à chaque boutique.
--
-- Chaque vendeur peut activer un ou plusieurs moyens d'encaissement (paiement
-- à la livraison, Kkiapay, FedaPay, SasPay, USSD). La configuration publique
-- (clé publique, code USSD, instructions) vit dans `store_payment_methods` ;
-- les secrets (clés privées / API / webhook) sont chiffrés dans
-- `store_payment_credentials` et ne quittent jamais le serveur.
--
-- Migration idempotente : rejouable sans erreur.

CREATE TABLE IF NOT EXISTS "store_payment_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "store_payment_methods_provider_check"
    CHECK ("provider" IN ('cod', 'kkiapay', 'fedapay', 'saspay', 'ussd'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_payment_methods_store_provider_unique"
  ON "store_payment_methods" ("store_id", "provider");

CREATE INDEX IF NOT EXISTS "store_payment_methods_store_enabled_idx"
  ON "store_payment_methods" ("store_id") WHERE "enabled" = true;

-- Secrets chiffrés AES-256-GCM (clé `PAYMENT_CREDENTIALS_KEY`). `payload` est
-- une chaîne opaque de la forme `v1:<iv>:<tag>:<ciphertext>` en base64.
CREATE TABLE IF NOT EXISTS "store_payment_credentials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "payload" text NOT NULL,
  "key_hint" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "store_payment_credentials_provider_check"
    CHECK ("provider" IN ('kkiapay', 'fedapay', 'saspay'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_payment_credentials_store_provider_unique"
  ON "store_payment_credentials" ("store_id", "provider");

-- Suivi d'encaissement d'une commande boutique. `token` est un secret non
-- devinable remis au client au moment du checkout : il permet de confirmer le
-- paiement sans authentification, mais uniquement pour sa propre commande.
CREATE TABLE IF NOT EXISTS "order_payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "store_id" uuid NOT NULL REFERENCES "stores"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "amount" numeric(12, 2) NOT NULL,
  "currency" text DEFAULT 'XOF' NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "token" text NOT NULL,
  "reference" text,
  "checkout_url" text,
  "provider_checkout_id" text,
  "failure_reason" text,
  "paid_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_payments_order_unique"
  ON "order_payments" ("order_id");

CREATE UNIQUE INDEX IF NOT EXISTS "order_payments_token_unique"
  ON "order_payments" ("token");

CREATE UNIQUE INDEX IF NOT EXISTS "order_payments_provider_checkout_unique"
  ON "order_payments" ("provider_checkout_id") WHERE "provider_checkout_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "order_payments_pending_idx"
  ON "order_payments" ("provider", "updated_at") WHERE "status" = 'PENDING';

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'PENDING' NOT NULL;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_reference" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_provider" text;

CREATE INDEX IF NOT EXISTS "orders_payment_status_idx" ON "orders" ("payment_status");
