-- Jetons push Expo des appareils mobiles.
--
-- Un utilisateur peut avoir plusieurs appareils. Le jeton est unique : quand
-- l'application se reconnecte, on réactive la ligne existante (upsert) au lieu
-- d'en créer une nouvelle. Les jetons signalés « DeviceNotRegistered » par Expo
-- sont désactivés automatiquement à l'envoi.
CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "platform" text DEFAULT 'android' NOT NULL,
  "device_name" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "push_tokens_user_idx" ON "push_tokens" ("user_id");
