-- Jetons push Expo pour les commandes invitées (sans compte)
CREATE TABLE IF NOT EXISTS "guest_push_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid REFERENCES "orders"("id") ON DELETE CASCADE,
  "email" text,
  "phone" text,
  "token" text NOT NULL UNIQUE,
  "platform" text DEFAULT 'android' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "expires_at" timestamp DEFAULT (now() + interval '30 days') NOT NULL
);

CREATE INDEX IF NOT EXISTS "guest_push_tokens_order_idx" ON "guest_push_tokens" ("order_id");
CREATE INDEX IF NOT EXISTS "guest_push_tokens_email_idx" ON "guest_push_tokens" ("email");
CREATE INDEX IF NOT EXISTS "guest_push_tokens_phone_idx" ON "guest_push_tokens" ("phone");
CREATE INDEX IF NOT EXISTS "guest_push_tokens_enabled_idx" ON "guest_push_tokens" ("enabled") WHERE "enabled" = true;
