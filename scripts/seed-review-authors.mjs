/**
 * Seed du pool d'auteurs fictifs (noms + photos) pour le boost des avis.
 *
 * Usage :
 *   node scripts/seed-review-authors.mjs ["chemin/vers/noms_fictifs.json"]
 *
 * Ordre de résolution de la source :
 *   1. argument en ligne de commande,
 *   2. `scripts/fixtures/review-authors.json` s'il existe,
 *   3. l'ancien fichier local (conservé par compatibilité),
 *   4. sinon : pool synthétique généré sur place (noms sénégalais + photos
 *      DiceBear) — plus aucune dépendance à un fichier de la machine.
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

const LEGACY_SOURCE = 'C:/Users/JACQUES/Downloads/noms_fictifs_10000 (1).json';
const FIXTURE_SOURCE = path.join('scripts', 'fixtures', 'review-authors.json');

const PRENOMS = [
  'Awa', 'Mamadou', 'Fatou', 'Ousmane', 'Aïssatou', 'Ibrahima', 'Mbacké', 'Ndèye',
  'Cheikh', 'Mariama', 'Pape', 'Khadidiatou', 'Samba', 'Astou', 'Yaya', 'Ndeye',
  'Alioune', 'Coumba', 'Modou', 'Sokhna', 'El Hadji', 'Mame', 'Karim', 'Bineta',
  'Souleymane', 'Aminata', 'Lamine', 'Khady', 'Boubacar', 'Seynabou', 'Djibril',
  'Nadia', 'Moussa', 'Rokhaya', 'Abdoulaye', 'Saratou', 'Mouhamed', 'Juletta',
];
const NOMS = [
  'Ndiaye', 'Ba', 'Sow', 'Diop', 'Fall', 'Sarr', 'Camara', 'Gueye', 'Thiam',
  'Diallo', 'Diouf', 'Mboup', 'Baldé', 'Kane', 'Diagne', 'Badara', 'Ndoye',
  'Khouma', 'Samb', 'Touré', 'Cissé', 'Kouyaté', 'Niane', 'Diamé', 'Sy',
  'Faye', 'Dieng', 'Mbaye', 'Ngom', 'Sagna', 'Diakhate', 'Gomis', 'Sané',
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Pool autonome : noms combinés sans doublon + avatar DiceBear stable. */
function buildSyntheticAuthors(count) {
  const seen = new Set();
  const out = [];
  // Base élevée : on ne risque jamais d'écraser les ids d'un JSON importé.
  let id = 1_000_000;
  while (out.length < count) {
    const prenom = pick(PRENOMS);
    const nom = pick(NOMS);
    const full = `${prenom} ${nom}`;
    if (seen.has(full)) continue;
    seen.add(full);
    out.push({
      id: id++,
      prenom,
      nom,
      nom_complet: full,
      sexe: Math.random() < 0.5 ? 'F' : 'M',
      photo: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(full)}`,
    });
  }
  return out;
}

function resolveSource() {
  const candidates = [
    process.argv[2],
    fs.existsSync(FIXTURE_SOURCE) ? FIXTURE_SOURCE : null,
    fs.existsSync(LEGACY_SOURCE) ? LEGACY_SOURCE : null,
  ].filter(Boolean);
  return candidates.find((c) => fs.existsSync(c)) || null;
}

const source = resolveSource();
let entries;
if (source) {
  entries = JSON.parse(fs.readFileSync(source, 'utf8'));
  console.log(`Source : ${source}`);
} else {
  entries = buildSyntheticAuthors(5000);
  console.log('Source : pool synthétique généré (aucun fichier trouvé)');
}
if (!Array.isArray(entries) || entries.length === 0) {
  console.error('❌ JSON vide ou invalide.');
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
