-- 0012_variants_json_cleanup.sql
-- Des produits avaient `variants` / `options` stockés en objet `{}` au lieu d'un
-- tableau JSON : toute lecture de tableau échouait. On réaligne sur `[]` et on
-- supprime les entrées qui ne sont pas des tableaux.

UPDATE "products"
SET "variants" = '[]'::jsonb
WHERE jsonb_typeof("variants") IS DISTINCT FROM 'array';

UPDATE "products"
SET "options" = '[]'::jsonb
WHERE jsonb_typeof("options") IS DISTINCT FROM 'array';
