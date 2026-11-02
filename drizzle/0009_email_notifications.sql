-- Migration : notifications email
-- Extension de l'outbox et des préférences pour le canal email (SMTP Gmail).
--
-- `notification_outbox` et `notification_preferences` étaient créées par
-- `0015_create_missing_tables.sql`, donc APRÈS ce fichier : les trois
-- instructions ci-dessous échouaient sur une base neuve (« relation
-- notification_outbox does not exist »), laissant le canal email sans
-- colonnes `recipient_email` / `preferences.email`. L'envoi échouait
-- silencieusement, et le schéma reconstruit depuis les migrations ne
-- correspondait pas à celui de production.
--
-- Les deux tables sont donc créées ici au préalable, à l'identique de 0015
-- (idempotent : IF NOT EXISTS ; les ALTER restent sans effet si les colonnes
-- existent déjà).

CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  phone text NOT NULL DEFAULT '',
  email text,
  event_type text NOT NULL,
  enabled boolean DEFAULT true NOT NULL,
  channel text DEFAULT 'whatsapp' NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_phone text NOT NULL,
  recipient_email text,
  event_type text NOT NULL,
  title text,
  body text NOT NULL,
  provider text DEFAULT 'whatsapp' NOT NULL,
  status text DEFAULT 'PENDING' NOT NULL,
  message_id text,
  template_name text,
  params jsonb DEFAULT '{}'::jsonb,
  attempts integer DEFAULT 0 NOT NULL,
  error text,
  scheduled_at timestamp,
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "notification_outbox" ADD COLUMN IF NOT EXISTS "recipient_email" text;

ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "email" text;

CREATE INDEX IF NOT EXISTS "notification_outbox_status_provider_idx" ON "notification_outbox" ("status", "provider");
