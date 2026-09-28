-- Migration : dedoublonnage des images produit
-- Cause : saveProductAction uploadait `image` ET `images[0]` separement sur R2.
--         Comme la cle R2 contient un crypto.randomUUID(), les deux uploads du
--         meme data URI produisaient deux URLs distinctes => meme image affichee
--         deux fois sur la page produit.

-- 1. Realigne images[0] sur la colonne canonique `image` pour les produits
--    n'ayant qu'une seule image de galerie (signe du double upload).
UPDATE "products" p
SET "images" = to_jsonb(ARRAY[p."image"])
WHERE p."image" IS NOT NULL
  AND p."images" IS NOT NULL
  AND jsonb_typeof(p."images") = 'array'
  AND jsonb_array_length(p."images") = 1
  AND (p."images" ->> 0) IS DISTINCT FROM p."image"
  AND (p."images" ->> 0) NOT LIKE 'data:%';

-- 2. Purge le tableau `images` : supprime les entrees vides, les data URI
--    residuels (toutes requetes par next/image) et les doublons internes.
UPDATE "products" p
SET "images" = COALESCE((
  SELECT jsonb_agg(s.e)
  FROM (
    SELECT DISTINCT ON (t.e #>> '{}') t.e
    FROM jsonb_array_elements(p."images") WITH ORDINALITY AS t(e, ord)
    WHERE jsonb_typeof(t.e) = 'string'
      AND (t.e #>> '{}') <> ''
      AND (t.e #>> '{}') NOT LIKE 'data:%'
    ORDER BY (t.e #>> '{}'), t.ord
  ) s
), '[]'::jsonb)
WHERE p."images" IS NOT NULL
  AND jsonb_typeof(p."images") = 'array'
  AND (
    p."images" <> '[]'::jsonb
    OR jsonb_array_length(p."images") > 0
  );
