-- SasPay : rapprochement des sessions de checkout avec les abonnements.
-- Les anciennes factures restent compatibles (provider est NULL).
ALTER TABLE subscription_payments
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS saspay_checkout_id text,
  ADD COLUMN IF NOT EXISTS saspay_payment_id text,
  ADD COLUMN IF NOT EXISTS saspay_charged_amount numeric(15, 2),
  ADD COLUMN IF NOT EXISTS saspay_net_amount numeric(15, 2),
  ADD COLUMN IF NOT EXISTS saspay_fee_charge_mode text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_saspay_checkout_unique
  ON subscription_payments (saspay_checkout_id) WHERE saspay_checkout_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS subscription_payments_saspay_payment_unique
  ON subscription_payments (saspay_payment_id) WHERE saspay_payment_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS subscription_payments_saspay_pending_idx
  ON subscription_payments (updated_at) WHERE provider = 'saspay' AND status = 'PENDING';
