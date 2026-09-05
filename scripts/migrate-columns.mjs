import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}

loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL introuvable dans .env.local');
    process.exit(1);
  }

  const sql = neon(url);

  console.log('Ajout des colonnes manquantes dans la base de données...');

  await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "phone" text;`;
  console.log('✔ profiles.phone vérifié/ajouté');

  await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "company_name" text;`;
  console.log('✔ profiles.company_name vérifié/ajouté');

  await sql`ALTER TABLE "profiles" ADD COLUMN IF NOT EXISTS "ninea" text;`;
  console.log('✔ profiles.ninea vérifié/ajouté');

  await sql`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "wholesale_tiers" jsonb DEFAULT '[]'::jsonb;`;
  console.log('✔ products.wholesale_tiers vérifié/ajouté');

  console.log('Migration terminée avec succès !');
}

main().catch((e) => {
  console.error('Erreur de migration:', e);
  process.exit(1);
});
