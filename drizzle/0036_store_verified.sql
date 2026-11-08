-- Badge « boutique vérifiée » — distribué UNIQUEMENT par l'admin (/pam/stores).
--
-- Tant que `verified_at` est NULL, la boutique n'affiche aucun badge
-- « Vérifié » (accueil, fiche produit, app mobile). L'admin bascule la
-- colonne via le toggle « Badge vérifié » de chaque fiche boutique.
--
-- Idempotente : rejouable sans erreur. Aucune donnée existante n'est
-- rétroactivement marquée — le badge disparaît partout jusqu'à décision admin.
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "verified_at" timestamp;
ALTER TABLE "stores" ADD COLUMN IF NOT EXISTS "verified_by" text;
CREATE INDEX IF NOT EXISTS "stores_verified_at_idx" ON "stores" ("verified_at");
