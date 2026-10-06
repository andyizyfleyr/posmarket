-- Marquage des données fabriquées par le panneau admin
-- « Booster les statistiques » (/pam/stores/[id]).
--
-- `orders.boosted`    : une commande boostée n'a jamais décrémenté le stock
--                       (`boostStoreOrdersAction` n'appelle pas
--                       `adjustProductStock`). Sans ce marqueur,
--                       annuler ou supprimer une commande boostée
--                       réintégrait du stock qui n'avait jamais été retiré.
-- `product_reviews.boosted` : identifie les avis générés pour pouvoir les
--                       distinguer / les retirer plus tard.

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "boosted" boolean NOT NULL DEFAULT false;
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "boosted" boolean NOT NULL DEFAULT false;
