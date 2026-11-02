-- Pool d'auteurs fictifs (nom complet + photo) utilisé par le boost des avis
-- admin, et colonne de stockage de la photo sur l'avis lui-même.
--
-- `review_authors.id` reprend l'`id` du JSON source : le seed est donc
-- rejouable (ON CONFLICT DO NOTHING).

CREATE TABLE IF NOT EXISTS "review_authors" (
  "id" integer PRIMARY KEY,
  "full_name" text NOT NULL,
  "gender" text,
  "avatar_url" text NOT NULL
);

ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "author_avatar" text;
