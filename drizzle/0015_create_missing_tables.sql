-- Create missing tables if they don't exist
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier text NOT NULL,
  token text NOT NULL,
  expires timestamp NOT NULL,
  PRIMARY KEY (identifier, token)
);

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at integer,
  token_type text,
  scope text,
  id_token text,
  session_state text
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_provider_account_id_idx ON accounts (provider, provider_account_id);

CREATE TABLE IF NOT EXISTS checkout_idempotency (
  key text PRIMARY KEY,
  order_ids jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier text NOT NULL,
  duration text NOT NULL,
  amount integer NOT NULL,
  currency text DEFAULT 'XOF' NOT NULL,
  transaction_id text UNIQUE,
  reference text,
  status text DEFAULT 'PENDING' NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  icon text,
  parent_id uuid REFERENCES product_categories(id) ON DELETE SET NULL,
  business_type text DEFAULT 'shopping' NOT NULL,
  position integer DEFAULT 0 NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS product_categories_parent_id_idx ON product_categories (parent_id);
CREATE INDEX IF NOT EXISTS product_categories_position_idx ON product_categories (position);
