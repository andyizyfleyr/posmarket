-- ============================================================================
-- 0002_system_settings.sql
-- Espace admin : paramètres système persistés en base de données.
-- Table simple clé/valeur pour stocker la configuration globale de la plateforme.
-- Idempotent : peut être ré-appliqué sans danger.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "system_settings" ("key", "value")
VALUES
  ('maintenance', 'false'),
  ('auto_indexing', 'true'),
  ('weekly_reports', 'true')
ON CONFLICT ("key") DO NOTHING;
