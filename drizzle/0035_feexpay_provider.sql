-- FeexPay : autoriser « feexpay » dans les contraintes provider créées par
-- 0034_store_payments.sql.
--
-- Les contraintes CHECK de 0034 listaient les moyens connus à l'époque :
--   store_payment_methods    IN ('cod', 'kkiapay', 'fedapay', 'saspay', 'ussd')
--   store_payment_credentials IN ('kkiapay', 'fedapay', 'saspay')
-- Toute écriture FeexPay échouait donc avec une violation de contrainte
-- (SQLSTATE 23514) — d'où « Impossible d'enregistrer ce moyen de paiement. »
-- côté application. Cette migration ré-émet les deux contraintes avec
-- « feexpay » inclus. Idempotente : rejouable sans erreur.

ALTER TABLE "store_payment_methods"
  DROP CONSTRAINT IF EXISTS "store_payment_methods_provider_check";
ALTER TABLE "store_payment_methods"
  ADD CONSTRAINT "store_payment_methods_provider_check"
  CHECK ("provider" IN ('cod', 'kkiapay', 'fedapay', 'feexpay', 'saspay', 'ussd'));

ALTER TABLE "store_payment_credentials"
  DROP CONSTRAINT IF EXISTS "store_payment_credentials_provider_check";
ALTER TABLE "store_payment_credentials"
  ADD CONSTRAINT "store_payment_credentials_provider_check"
  CHECK ("provider" IN ('kkiapay', 'fedapay', 'feexpay', 'saspay'));
