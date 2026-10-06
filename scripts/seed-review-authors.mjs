/**
 * Seed du pool d'auteurs fictifs (noms + photos) pour le boost des avis.
 *
 * Usage :
 *   node scripts/seed-review-authors.mjs ["chemin/vers/noms_fictifs.json"]
 *
 * Le fichier JSON doit être un tableau de { id, prenom, nom, nom_complet,
 * sexe, photo }. Rejouable : les doublons d'id sont ignorés.
 */
import fs from 'node:fs';
import path from 'node:path';
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
import { runSqlFile } from './lib/sql.mjs';

config({ path: '.env.local' });
const sql = neon(process.env.DATABASE_URL);

const source = process.argv[2] || 'C:/Users/JACQUES/Downloads/noms_fictifs_10000 (1).json';
if (!fs.existsSync(source)) {
  console.error(`❌ Fichier introuvable : ${source}`);
  process.exit(1);
}

await runSqlFile(sql, path.join('drizzle', '0020_review_authors.sql'));

const entries = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!Array.isArray(entries) || entries.length === 0) {
  console.error('❌ JSON vide ou invalide.');
  process.exit(1);
}

const [before] = await sql`SELECT count(*)::int AS total FROM "review_authors"`;

const BATCH = 500;
let attempted = 0;
for (let i = 0; i < entries.length; i += BATCH) {
  const chunk = entries.slice(i, i + BATCH).map((e) => ({
    id: Number(e.id),
    full_name: String(e.nom_complet || `${e.prenom || ''} ${e.nom || ''}`.trim() || 'Anonyme'),
    gender: e.sexe || null,
    avatar_url: String(e.photo || ''),
  })).filter((e) => Number.isFinite(e.id) && e.avatar_url);

  if (chunk.length === 0) continue;

  // Sans RETURNING, le driver HTTP ne renvoie aucune ligne : on compare
  // les compteurs avant/après pour mesurer l'insertion.
  await sql`
    INSERT INTO "review_authors" ("id", "full_name", "gender", "avatar_url")
    SELECT (r->>'id')::int, r->>'full_name', r->>'gender', r->>'avatar_url'
    FROM jsonb_array_elements(${JSON.stringify(chunk)}::jsonb) AS r
    ON CONFLICT ("id") DO UPDATE SET
      "full_name" = EXCLUDED."full_name",
      "gender" = EXCLUDED."gender",
      "avatar_url" = EXCLUDED."avatar_url"
  `;
  attempted += chunk.length;
}

const [stat] = await sql`
  SELECT count(*)::int AS total,
         count(*) FILTER (WHERE avatar_url <> '')::int AS with_photo
  FROM "review_authors"
`;
const [reviews] = await sql`
  SELECT count(*)::int AS total FROM "product_reviews"
`;

const delta = (stat?.total ?? 0) - (before?.total ?? 0);
console.log(`Lignes traitées : ${attempted} — nouvelles : ${delta}`);
console.log(`Pool total : ${stat?.total ?? 0} auteurs, dont ${stat?.with_photo ?? 0} avec photo`);
console.log(`Avis en base : ${reviews?.total ?? 0}`);
console.log('\n✅ Pool d\'auteurs prêt.');
