-- Suivi des commandes invitées : le téléphone saisi au checkout doit être
-- conservé sur la commande.
--
-- `guest_push_tokens.phone` existait déjà, et la route
-- `/api/marketplace/guest/push-token` prétendait vérifier le numéro… en lisant
-- `orders.buyer_phone`, colonne qui n'existait pas. La comparaison portait donc
-- toujours sur `undefined` : la vérification était morte et n'importe quel
-- numéro passait pour n'importe quelle commande.
--
-- Migration idempotente : rejouable sans erreur.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "buyer_phone" text;

-- Recherche des commandes invitées par téléphone (support et rapprochement
-- des jetons push) sans parcours séquentiel.
CREATE INDEX IF NOT EXISTS "orders_buyer_phone_idx" ON "orders" ("buyer_phone");
