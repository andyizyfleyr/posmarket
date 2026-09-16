-- Migration : notifications WhatsApp
-- Tables notification_preferences (opt-in par type/événement) et notification_outbox (file + historique des envois).

CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid REFERENCES "profiles" ("id") ON DELETE CASCADE,
  "phone" text NOT NULL,
  "event_type" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "channel" text DEFAULT 'whatsapp' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  UNIQUE ("user_id", "event_type", "phone")
);

CREATE INDEX IF NOT EXISTS "notification_preferences_user_idx" ON "notification_preferences" ("user_id");

CREATE TABLE IF NOT EXISTS "notification_outbox" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "recipient_user_id" uuid REFERENCES "profiles" ("id") ON DELETE SET NULL,
  "recipient_phone" text NOT NULL,
  "event_type" text NOT NULL,
  "title" text,
  "body" text NOT NULL,
  "provider" text DEFAULT 'whatsapp' NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "message_id" text,
  "template_name" text,
  "params" jsonb DEFAULT '{}'::jsonb,
  "attempts" integer DEFAULT 0 NOT NULL,
  "error" text,
  "scheduled_at" timestamp,
  "sent_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_outbox_status_scheduled_idx" ON "notification_outbox" ("status", "scheduled_at");
CREATE INDEX IF NOT EXISTS "notification_outbox_recipient_idx" ON "notification_outbox" ("recipient_user_id");