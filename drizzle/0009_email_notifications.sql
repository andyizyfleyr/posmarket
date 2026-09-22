-- Migration : notifications email
-- Extension de l'outbox et des préférences pour le canal email (SMTP Gmail).

ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "recipient_email" text;

ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "email" text;

CREATE INDEX IF NOT EXISTS "notification_outbox_status_provider_idx" ON "notification_outbox" ("status", "provider");