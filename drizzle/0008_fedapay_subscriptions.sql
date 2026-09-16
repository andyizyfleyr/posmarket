-- FedaPay - paiements d'abonnement
-- Table de suivi des paiements d'abonnement initiés via FedaPay.
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tier text NOT NULL,
  duration text NOT NULL,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'XOF',
  transaction_id text UNIQUE,
  reference text,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_user ON subscription_payments (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_transaction ON subscription_payments (transaction_id);