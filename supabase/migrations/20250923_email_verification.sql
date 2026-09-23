-- Google OAuth account linking (Auth.js)

CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  provider_account_id text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_provider_provider_account_id_idx
  ON accounts(provider, provider_account_id);