-- 0013_checkout_idempotency.sql
-- Un double envoi de « Confirmer la commande » ne doit pas créer deux fois la
-- même commande. Le client transmet une clé d'idempotence (générée une fois
-- par tentative de paiement) ; l'action serveur réserve cette clé avant de
-- créer les commandes. Un rejeu de la même clé ne recrée rien et renvoie les
-- références déjà créées.

CREATE TABLE IF NOT EXISTS "checkout_idempotency" (
  "key" text PRIMARY KEY,
  -- NULL tant que la tentative est en cours : une clé réservée mais vide
  -- signale un envoi simultané, pas un rejeu terminé.
  "order_ids" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Nettoyage : les clés n'ont de valeur que le temps d'une tentative.
CREATE INDEX IF NOT EXISTS "checkout_idempotency_created_at_idx"
  ON "checkout_idempotency" ("created_at");
