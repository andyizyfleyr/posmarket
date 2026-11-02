/**
 * Vérifie que `npm run db:migrate` peut reconstruire tout le schéma.
 *
 * Deux dérives sont détectées, toutes deux déjà survenues dans ce dépôt :
 *
 * 1. **Fichier SQL absent du journal** : `drizzle-kit migrate` ne joue que les
 *    entrées de `drizzle/meta/_journal.json`. Sept migrations (dont
 *    `push_tokens`, `guest_push_tokens` et `api_rate_limits`) existaient sur le
 *    disque sans être journalisées : une base neuve sortait sans ces tables.
 * 2. **Préfixe numérique dupliqué** : deux fichiers `0025_*` rendaient l'ordre
 *    d'application ambigu pour tout outil qui trie par nom.
 *
 * Les paires historiques 0011_* et 0012_* (DDL + seed/nettoyage) sont
 * explicitement tolérées : leur ordre est fixé dans le journal.
 *
 * Usage : `node scripts/check-migration-journal.mjs` (code 1 si dérive).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const drizzleDir = path.join(root, 'drizzle');
const journalPath = path.join(drizzleDir, 'meta', '_journal.json');

/** Suffixes dupliqués volontairement ordonnés (DDL puis complément). */
const ORDERED_DUPLICATE_TAGS = new Set([
  '0011_product_categories',
  '0011_product_categories_seed',
  '0012_order_item_variants',
  '0012_variants_json_cleanup',
]);

const files = fs
  .readdirSync(drizzleDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const stripExt = (file) => (file.endsWith('.sql') ? file.slice(0, -4) : file);

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const journalTags = new Set(journal.entries.map((entry) => entry.tag));

const problems = [];

// 1. Fichier SQL non journalisé (db:migrate l'ignorerait)
for (const file of files) {
  const tag = stripExt(file);
  if (!journalTags.has(tag)) {
    problems.push(`fichier non journalisé (db:migrate l'ignorera) : drizzle/${file}`);
  }
}

// 2. Entrée du journal sans fichier SQL correspondant
for (const entry of journal.entries) {
  if (!files.includes(`${entry.tag}.sql`)) {
    problems.push(`entrée du journal sans fichier SQL : ${entry.tag}`);
  }
}

// 3. Préfixes numériques dupliqués
const byPrefix = new Map();
for (const file of files) {
  const match = /^(\d{4})_/.exec(file);
  if (!match) {
    problems.push(`nom sans préfixe numérique à 4 chiffres : drizzle/${file}`);
    continue;
  }
  const prefix = match[1];
  if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
  byPrefix.get(prefix).push(file);
}

for (const [prefix, group] of byPrefix) {
  if (group.length <= 1) continue;
  const tolerated = group.every((file) => ORDERED_DUPLICATE_TAGS.has(stripExt(file)));
  if (!tolerated) {
    problems.push(`préfixe ${prefix} dupliqué : ${group.join(', ')}`);
  }
}

if (problems.length > 0) {
  console.error(`✗ ${problems.length} problème(s) de migration :`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log(
  `✓ ${files.length} migrations cohérentes (journal : ${journal.entries.length} entrées).`,
);
