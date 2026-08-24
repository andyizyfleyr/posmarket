/**
 * Migration one-shot : envoie les images base64 de la DB vers Cloudflare R2
 * et remplace les colonnes par des URLs publiques.
 *
 * Prérequis (env) :
 *   DATABASE_URL, CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID,
 *   R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL
 *
 * Usage : node --env-file=.env.local scripts/migrate-images-r2.mts
 */
import { neon } from '@neondatabase/serverless';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const sql = neon(process.env.DATABASE_URL!);

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const PUBLIC_URL = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

async function upload(dataUri: string, folder: string): Promise<string | null> {
  const m = /^data:(image\/[a-z0-9.+-]+);base64,([\s\S]+)$/.exec(dataUri);
  if (!m) return null;
  const ext = EXT_BY_MIME[m[1]] || 'bin';
  const bytes = Buffer.from(m[2], 'base64');
  const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: bytes,
    ContentType: m[1],
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `${PUBLIC_URL}/${key}`;
}

let done = 0;
let failed = 0;

async function migrateProducts() {
  const rows = (await sql`
    SELECT id, image FROM products WHERE image LIKE 'data:%'`) as { id: string; image: string }[];
  console.log(`Produits avec images base64 : ${rows.length}`);
  for (const [i, row] of rows.entries()) {
    try {
      const url = await upload(row.image, 'products');
      if (url) {
        await sql`UPDATE products SET image = ${url} WHERE id = ${row.id}`;
        done++;
      }
    } catch (e) {
      failed++;
      console.error(`  produit ${row.id} : ${(e as Error).message}`);
    }
    if ((i + 1) % 10 === 0) console.log(`  produits ${i + 1}/${rows.length}`);
  }
}

async function migrateLogos() {
  const rows = (await sql`
    SELECT id, settings->>'logo' AS logo FROM stores
    WHERE settings->>'logo' LIKE 'data:%'`) as { id: string; logo: string }[];
  console.log(`Boutiques avec logos base64 : ${rows.length}`);
  for (const [i, row] of rows.entries()) {
    try {
      const url = await upload(row.logo, 'logos');
      if (url) {
        await sql`UPDATE stores SET settings = jsonb_set(settings, '{logo}', ${JSON.stringify(url)}::jsonb) WHERE id = ${row.id}`;
        done++;
      }
    } catch (e) {
      failed++;
      console.error(`  boutique ${row.id} : ${(e as Error).message}`);
    }
    if ((i + 1) % 10 === 0) console.log(`  logos ${i + 1}/${rows.length}`);
  }
}

const only = process.argv[2];
if (only !== 'logos') await migrateProducts();
if (only !== 'products') await migrateLogos();
console.log(`Terminé : ${done} migrées, ${failed} échecs.`);
