#!/usr/bin/env node
/**
 * Remplace en masse les images des produits d'une boutique.
 *
 * Conçu pour le cas réel : un lot de photos retravaillées en HD, à réaffecter
 * aux produits existants sans toucher au reste (prix, stock, description,
 * variantes, statut en ligne…).
 *
 * ── Pourquoi pas du SQL ────────────────────────────────────────────────────
 *
 * `saveProductAction` (src/app/actions/inventory.ts) recalcule `image` ET
 * `images` à partir de ce qu'on lui donne, puis écrit le produit entier. Une
 * mise à jour SQL directe laisserait les deux colonnes désynchronisées : la
 * fiche afficherait la nouvelle photo, la galerie l'ancienne. Pire, le champ
 * `isOnline` vaut `true` par défaut quand il est absent — un UPDATE partiel qui
 * l'omet republierait tous les produits dépubliés.
 *
 * Ce script écrit donc `image` et `images` ensemble, et ne touche à aucune
 * autre colonne.
 *
 * ── Sécurité ───────────────────────────────────────────────────────────────
 *
 *   - simulation par défaut : rien n'est écrit sans `--apply` ;
 *   - une sauvegarde JSON est produite avant toute écriture ;
 *   - `--rollback` restaure les anciennes valeurs depuis cette sauvegarde ;
 *   - seuls les produits de la boutique ciblée sont modifiés ;
 *   - les produits sans correspondance sont listés, jamais devinés.
 *
 * ── Usage (PowerShell) ─────────────────────────────────────────────────────
 *
 *   # 1. Inventaire des fichiers et des produits, sans rien écrire
 *   npm run images:replace -- --store 5b5ca452-6660-4405-88e8-500f08f4e402 --dir "D:\Photos HD"
 *
 *   # 2. Vérifier le rapport produit par produit (matching.csv)
 *
 *   # 3. Appliquer
 *   npm run images:replace -- --store … --dir "…" --apply
 *
 *   # 4. En cas de problème
 *   npm run images:replace -- --rollback backups/images-agla-<date>.json
 *
 * Les clés R2 (`CLOUDFLARE_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
 * `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`) sont lues dans
 * `.env.local`, puis `.env`, puis l'environnement.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

// ── Configuration ─────────────────────────────────────────────────────────

function loadEnv() {
  for (const name of ['.env.local', '.env']) {
    const envPath = path.resolve(process.cwd(), name);
    if (!fs.existsSync(envPath)) continue;
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (match && !(match[1] in process.env)) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
      }
    }
  }
}

/**
 * Valeur d'une option.
 *
 * Le garde `--` couvre l'appel via npm : `npm run x -- --store abc` transmet
 * bien `abc`, mais un `--dir` relatif peut être précédé d'artefacts selon le
 * shell. On ignore donc les valeurs qui commencent par un tiret.
 */
function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) {
    return process.argv[i + 1];
  }
  return fallback;
}

/** Sur Windows, PowerShell coupe parfois les chemins contenant des espaces. */
function cleanDir(p) {
  return String(p || '').trim().replace(/^["']|["']$/g, '');
}

const hasFlag = (name) => process.argv.includes(`--${name}`);

loadEnv();

const STORE_ID = arg('store');
const DIR = cleanDir(arg('dir'));
const APPLY = hasFlag('apply');
const ROLLBACK = arg('rollback');
const MIN_SCORE = Number(arg('min-score', '0.82'));
const FORCE = hasFlag('force');

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

const C = {
  reset: '\u001b[0m', bold: '\u001b[1m', dim: '\u001b[90m',
  green: '\u001b[32m', red: '\u001b[31m', yellow: '\u001b[33m', cyan: '\u001b[36m',
};
const ok = (m) => console.log(`${C.green}✓${C.reset} ${m}`);
const ko = (m) => console.log(`${C.red}✗${C.reset} ${m}`);
const warn = (m) => console.log(`${C.yellow}!${C.reset} ${m}`);
const step = (m) => console.log(`${C.cyan}→${C.reset} ${m}`);

// ── Connexion base (même double transport que les migrations) ─────────────

async function makeRunner() {
  const url = process.env.DATABASE_URL || process.env.DIRECT_URL;
  if (!url) throw new Error('DATABASE_URL (ou DIRECT_URL) est requis.');

  try {
    const { neon } = await import('@neondatabase/serverless');
    const neonSql = neon(url);
    await neonSql`select 1 as ok`;
    return {
      transport: 'Neon HTTPS',
      run: async (text, params) => {
        const r = params ? await neonSql(text, params) : await neonSql(text);
        return Array.isArray(r) ? r : [];
      },
      close: async () => {},
    };
  } catch {
    /* bascule TCP */
  }

  const pg = (await import('pg')).default;
  const client = new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });
  await client.connect();
  return {
    transport: 'PostgreSQL TCP',
    run: async (text, params) => (await client.query(text, params)).rows || [],
    close: async () => client.end(),
  };
}

// ── Correspondance nom de produit ↔ nom de fichier ────────────────────────

/** Minuscules, sans accents, sans ponctuation : « Boîte 30g N°2 » → « boite 30g n 2 ». */
function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Mots vides : grammaire et unités de vente SEULEMENT.
 *
 * Ne jamais y mettre un mot métier (« boite », « couvercle », « pompe ») : ce
 * sont précisément eux qui distinguent les produits entre eux.
 */
const STOP_WORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'pour', 'avec', 'et', 'en',
  'au', 'aux', 'sur', 'par', 'dz', 'douzaine', 'unite',
  'jpg', 'jpeg', 'png', 'webp', 'avif', 'hd',
]);

/**
 * Couleurs et finitions : deux produits identiques sauf par la teinte sont
 * deux produits DIFFÉRENTS. « carré rose » ne doit jamais hériter de la photo
 * « carré noire ».
 */
const COLOR_ROOTS = [
  'rose', 'noir', 'blanc', 'jaune', 'vert', 'bleu', 'rouge', 'marron', 'beige',
  'gris', 'or', 'dore', 'doree', 'argente', 'argent', 'cristal', 'transparent',
  'bois', 'clair', 'fonce', 'turquoise', 'violet', 'orange',
];

/**
 * Tokens d'un nom, avec les contenances isolées.
 *
 * `measure` sert de garde-fou fort : 30g et 250ml ne peuvent pas être le même
 * article, même si le reste du nom se ressemble.
 */
function tokens(text) {
  const norm = normalize(text);
  const measure = (norm.match(/\d+\s?(g|kg|ml|l)\b/g) || []).map((m) => m.replace(/\s/g, ''));
  const words = norm.split(' ').filter((w) => w.length > 1);
  return { norm, measure, words };
}

/** Mots porteurs de sens, pour comparer deux noms sans le bruit grammatical. */
function keyWords(text) {
  const { words } = tokens(text);
  const kept = words.filter((w) => !STOP_WORDS.has(w));
  return kept.length > 0 ? kept : words;
}

/** Teintes citées dans un nom, ramenées à leur racine. */
function colors(text) {
  const out = new Set();
  for (const word of tokens(text).words) {
    for (const root of COLOR_ROOTS) {
      if (word === root || (word.length > 3 && root.length > 3 && (word.startsWith(root) || root.startsWith(word)))) {
        out.add(root === 'doree' ? 'dore' : root);
        break;
      }
    }
  }
  return out;
}

/**
 * Score de correspondance entre un nom de produit et un nom de fichier, de 0 à 1.
 *
 * La couverture est calculée du point de vue du PRODUIT (quelle fraction de ses
 * mots retrouve-t-on dans le fichier), sinon un fichier au nom très long serait
 * pénalisé à tort.
 *
 * Deux conflits disqualifient pratiquement un rapprochement :
 *   - contenance contradictoire (30g vs 250ml)  → −0.45
 *   - teinte contradictoire (rose vs noire)      → −0.50
 */
function score(name, filename) {
  const a = tokens(name);
  const b = tokens(filename);
  const ka = keyWords(name);
  const kb = keyWords(filename);

  let measureMatch = null;
  if (a.measure.length > 0 && b.measure.length > 0) {
    measureMatch = a.measure.some((m) => b.measure.includes(m));
  }

  const setB = new Set(kb);
  const found = ka.filter((w) => setB.has(w)).length;
  const coverage = found / (ka.length || 1);
  const jaccard = found / (new Set([...ka, ...kb]).size || 1);

  const ca = colors(name);
  const cb = colors(filename);
  const colorConflict = ca.size > 0 && cb.size > 0 && ![...ca].some((c) => cb.has(c));

  let value = coverage * 0.6 + jaccard * 0.4;
  if (measureMatch === true) value += 0.25;
  if (measureMatch === false) value -= 0.45;
  if (colorConflict) value -= 0.5;

  return Math.max(0, Math.min(1, value));
}

// ── Rollback ──────────────────────────────────────────────────────────────

async function rollback(file) {
  if (!fs.existsSync(file)) {
    ko(`sauvegarde introuvable : ${file}`);
    process.exit(1);
  }
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  step(`restauration de ${backup.rows.length} produit(s) depuis ${path.basename(file)}`);

  const db = await makeRunner();
  console.log(`  transport : ${db.transport}`);
  let restored = 0;
  for (const row of backup.rows) {
    await db.run(
      `UPDATE products SET image = $1, images = $2::jsonb WHERE id = $3 AND store_id = $4`,
      [row.image, JSON.stringify(row.images ?? []), row.id, backup.storeId],
    );
    restored += 1;
  }
  await db.close();
  ok(`${restored} produit(s) restauré(s). Pense à revalider le cache de la marketplace.`);
}

// ── Programme principal ───────────────────────────────────────────────────

async function main() {
  if (ROLLBACK) return rollback(ROLLBACK);

  if (!STORE_ID) {
    console.error('Usage : npm run images:replace -- --store <uuid> --dir "<dossier photos>" [--apply]');
    process.exit(1);
  }
  if (!DIR || !fs.existsSync(DIR)) {
    ko(`dossier introuvable : ${DIR || '(non fourni)'}`);
    process.exit(1);
  }

  // 1. Les fichiers du dossier (récursif : les sous-dossiers sont acceptés)
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) files.push(full);
    }
  };
  walk(DIR);

  if (files.length === 0) {
    ko(`aucune image (${[...IMAGE_EXT].join(', ')}) trouvée dans ${DIR}`);
    process.exit(1);
  }
  step(`${files.length} image(s) trouvée(s) dans ${DIR}`);

  // 2. Les produits de la boutique
  const db = await makeRunner();
  console.log(`  transport base : ${db.transport}`);

  const [store] = await db.run(
    `SELECT id, name, slug FROM stores WHERE id = $1`,
    [STORE_ID],
  );
  if (!store) {
    ko(`boutique introuvable : ${STORE_ID}`);
    process.exit(1);
  }
  ok(`boutique : ${store.name}`);

  const products = await db.run(
    `SELECT id, name, image, images FROM products WHERE store_id = $1 ORDER BY name`,
    [STORE_ID],
  );
  step(`${products.length} produit(s) en base`);

  // 3. Appariement : pour chaque fichier, le meilleur produit libre
  const candidates = [];
  for (const file of files) {
    const base = path.basename(file, path.extname(file));
    for (const product of products) {
      candidates.push({ file, product, value: score(product.name, base) });
    }
  }
  candidates.sort((a, b) => b.value - a.value);

  const usedFiles = new Set();
  const usedProducts = new Map();
  for (const c of candidates) {
    if (c.value < MIN_SCORE) continue;
    if (usedFiles.has(c.file) || usedProducts.has(c.product.id)) continue;
    usedFiles.add(c.file);
    usedProducts.set(c.product.id, c);
  }

  const matched = [...usedProducts.values()].sort((a, b) => b.value - a.value);
  const unmatchedProducts = products.filter((p) => !usedProducts.has(p.id));
  const unmatchedFiles = files.filter((f) => !usedFiles.has(f));

  // 4. Rapport lisible + CSV pour vérification à la main
  console.log('');
  console.log(`${C.bold}Appariement${C.reset} (seuil ${MIN_SCORE})`);
  for (const m of matched) {
    const pct = Math.round(m.value * 100);
    const color = pct >= 90 ? C.green : pct >= 80 ? C.yellow : C.red;
    console.log(`  ${color}${String(pct).padStart(3)}%${C.reset}  ${m.product.name}`);
    console.log(`         ${C.dim}← ${path.basename(m.file)}${C.reset}`);
  }

  fs.mkdirSync('backups', { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const csvPath = `backups/matching-${stamp}.csv`;
  const csv = ['score;produit;fichier;ancienne_image;nouvelle_image',
    ...matched.map((m) => [
      (m.value * 100).toFixed(0),
      m.product.name.replace(/;/g, ','),
      path.basename(m.file),
      m.product.image || '',
      `(sera uploadée)`,
    ].join(';')),
    ...unmatchedProducts.map((p) => ['0', p.name.replace(/;/g, ','), '(aucun fichier)', p.image || '', ''].join(';')),
  ].join('\r\n');
  fs.writeFileSync(csvPath, '\ufeff' + csv, 'utf8');

  console.log('');
  ok(`${matched.length} correspondance(s) — rapport : ${csvPath}`);
  if (unmatchedProducts.length > 0) {
    warn(`${unmatchedProducts.length} produit(s) sans image correspondante :`);
    for (const p of unmatchedProducts.slice(0, 20)) console.log(`    ${C.dim}${p.name}${C.reset}`);
    if (unmatchedProducts.length > 20) console.log(`    ${C.dim}… et ${unmatchedProducts.length - 20} autre(s)${C.reset}`);
  }
  if (unmatchedFiles.length > 0) {
    warn(`${unmatchedFiles.length} fichier(s) non utilisé(s) :`);
    for (const f of unmatchedFiles.slice(0, 20)) console.log(`    ${C.dim}${path.basename(f)}${C.reset}`);
  }

  if (matched.length === 0) {
    ko('aucune correspondance retenue : rien à faire.');
    await db.close();
    process.exit(1);
  }

  if (!APPLY) {
    console.log('');
    warn('mode simulation — AUCUNE écriture. Relance avec --apply pour appliquer.');
    console.log(`${C.dim}  Vérifie d'abord ${csvPath} : les lignes à 0 % sont des produits non traités.${C.reset}`);
    await db.close();
    return;
  }

  // 5. Sauvegarde avant écriture
  const backupPath = `backups/images-${store.slug || STORE_ID}-${stamp}.json`;
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        storeId: STORE_ID,
        storeName: store.name,
        rows: matched.map((m) => ({
          id: m.product.id,
          name: m.product.name,
          image: m.product.image,
          images: m.product.images ?? [],
        })),
      },
      null,
      2,
    ),
    'utf8',
  );
  ok(`sauvegarde : ${backupPath}`);

  // 6. Upload R2 + écriture
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const publicUrl = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !bucket || !publicUrl) {
    ko('configuration R2 incomplète (CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL).');
    await db.close();
    process.exit(1);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  console.log('');
  console.log(`${C.bold}Envoi${C.reset}`);
  let done = 0;
  for (const m of matched) {
    const ext = path.extname(m.file).toLowerCase();
    const key = `products/${Date.now()}-${crypto.randomUUID()}${ext}`;

    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: fs.readFileSync(m.file),
          ContentType: MIME[ext] || 'application/octet-stream',
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      const url = `${publicUrl}/${key}`;
      // `image` ET `images` ensemble : sinon la fiche et la galerie divergent.
      await db.run(
        `UPDATE products SET image = $1, images = $2::jsonb WHERE id = $3 AND store_id = $4`,
        [url, JSON.stringify([url]), m.product.id, STORE_ID],
      );

      done += 1;
      console.log(`  ${C.green}✓${C.reset} ${m.product.name}`);
    } catch (error) {
      ko(`${m.product.name} — ${error?.message || error}`);
    }
  }

  await db.close();
  console.log('');
  ok(`${done}/${matched.length} produit(s) mis à jour.`);
  console.log(`${C.dim}  Retour arrière possible : npm run images:replace -- --rollback ${backupPath}${C.reset}`);
  if (!FORCE) {
    console.log(`${C.dim}  Le cache CDN peut servir l'ancienne image quelques minutes : vérifie avec /product/<slug>?v=2${C.reset}`);
  }
}

main().catch((error) => {
  ko(error?.message || String(error));
  process.exit(1);
});
