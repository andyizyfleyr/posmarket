-- Compteurs de limitation de débit partagés entre les instances (Vercel).
--
-- Le limiteur en mémoire est rapide mais propre à chaque instance : un
-- attaquant peut changer d'instance pour repartir à zéro. Cette table sert
-- aux quotas stricts (connexion, encaissement, administration).
CREATE TABLE IF NOT EXISTS "api_rate_limits" (
  "key" text PRIMARY KEY NOT NULL,
  "count" integer DEFAULT 0 NOT NULL,
  "reset_at" timestamp NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "api_rate_limits_reset_at_idx" ON "api_rate_limits" ("reset_at");
