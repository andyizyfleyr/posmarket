/**
 * Migration one-shot : dedoublonnage des images produit
 *
 * Cause historique : saveProductAction uploadait `image` ET `images[0]`
 * séparément sur R2 ; la cle R2 contenant un crypto.randomUUID(), les deux
 * uploads du meme data URI produisaient deux URLs distinctes => la meme image
 * s'affichait deux fois sur la page produit.
 *
 * Usage : node scripts/apply-migration-0010-images.mjs
 */
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const [before] = await sql`
  SELECT
    count(*) FILTER (WHERE jsonb_typeof("images") = 'array' AND jsonb_array_length("images") >= 1)::int AS with_images,
    count(*) FILTER (
      WHERE jsonb_typeof("images") = 'array'
        AND jsonb_array_length("images") = 1
        AND "image" IS NOT NULL
        AND ("images" ->> 0) IS DISTINCT FROM "image"
    )::int AS single_dup,
    count(*) FILTER (
      WHERE jsonb_typeof("images") = 'array'
        AND ("images"::text LIKE '%data:%')
    )::int AS with_data_uri
  FROM "products"
`;
console.log('Avant :', before);

await runSqlFile(sql, 'drizzle/0010_dedupe_product_images.sql');

const [after] = await sql`
  SELECT
    count(*) FILTER (WHERE jsonb_typeof("images") = 'array' AND jsonb_array_length("images") >= 1)::int AS with_images,
    count(*) FILTER (
      WHERE jsonb_typeof("images") = 'array'
        AND jsonb_array_length("images") = 1
        AND "image" IS NOT NULL
        AND ("images" ->> 0) IS DISTINCT FROM "image"
    )::int AS single_dup,
    count(*) FILTER (
      WHERE jsonb_typeof("images") = 'array'
        AND ("images"::text LIKE '%data:%')
    )::int AS with_data_uri
  FROM "products"
`;
console.log('\nApres :', after);
console.log('\n✅ Migration dedoublonnage images appliquee.');
