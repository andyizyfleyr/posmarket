// Genere drizzle/0011_product_categories_seed.sql depuis src/constants.ts
import { readFileSync, writeFileSync } from 'node:fs';

const src = readFileSync('src/constants.ts', 'utf8');

const mainBlock = src.match(/export const MAIN_CATEGORIES = \[(.*?)\];/s)?.[1] ?? '';
const mapBlock = src.match(/export const CATEGORY_MAPPING: Record<string, string> = \{(.*?)\};/s)?.[1] ?? '';

const mains = [...mainBlock.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((m) => m[1]);
const pairs = [...mapBlock.matchAll(/'((?:[^'\\]|\\.)*)'\s*:\s*'((?:[^'\\]|\\.)*)'/g)].map((m) => ({
  sub: m[1],
  main: m[2],
}));

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const bt = (main) => (main === 'Restauration & Livraison Rapide' ? 'food' : 'shopping');

const mainValues = mains.map((name, i) => `  (${q(name)}, ${q(slugify(name))}, ${q(bt(name))}, ${i})`);

const seen = new Set();
const subValues = [];
for (const [i, p] of pairs.entries()) {
  if (seen.has(p.sub)) continue;
  seen.add(p.sub);
  subValues.push(`    (${q(p.sub)}, ${q(slugify(p.sub))}, ${q(bt(p.main))}, ${i}, ${q(p.main)})`);
}

const out = `-- Seed de la taxonomie produit : reprend les categories historiquement
-- codees en dur dans src/constants.ts (MAIN_CATEGORIES + CATEGORY_MAPPING).
-- products.main_category <- categorie parente, products.category <- sous-categorie.

INSERT INTO "product_categories" (name, slug, business_type, position) VALUES
${mainValues.join(',\n')}
ON CONFLICT (name) DO NOTHING;

-- Sous-categories rattachees a leur categorie parente.
INSERT INTO "product_categories" (name, slug, business_type, position, parent_id)
SELECT v.name, v.slug, p.business_type, v.position, p.id
FROM (VALUES
${subValues.join(',\n')}
) AS v(name, slug, business_type, position, parent_name)
JOIN "product_categories" p ON p.name = v.parent_name AND p.parent_id IS NULL
ON CONFLICT (name) DO NOTHING;
`;

writeFileSync('drizzle/0011_product_categories_seed.sql', out, 'utf8');
console.log(`mains=${mains.length} subs=${subValues.length}`);
