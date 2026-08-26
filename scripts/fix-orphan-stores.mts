/**
 * fix-orphan-stores.mts
 * Crée des profils pour chaque user_id orphelin dans stores.
 * Usage: npx tsx scripts/fix-orphan-stores.mts
 */
import { Client } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Lecture DATABASE_URL depuis .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const dbUrl = envContent.split('\n').find(l => l.startsWith('DATABASE_URL='))?.split('=').slice(1).join('=');

if (!dbUrl) {
  console.error('DATABASE_URL introuvable dans .env.local');
  process.exit(1);
}

const client = new Client({ connectionString: dbUrl });

async function main() {
  await client.connect();

  // 1. Compter les orphelins
  const orphans = await client.query(`
    SELECT s.user_id, COUNT(*) AS store_count
    FROM stores s
    LEFT JOIN profiles p ON p.id = s.user_id
    WHERE p.id IS NULL
    GROUP BY s.user_id
  `);

  console.log(`\n ${orphans.rows.length} user_id(s) orphelin(s) trouvé(s) :`);
  for (const row of orphans.rows) {
    console.log(`   ${row.user_id} → ${row.store_count} boutique(s)`);
  }

  if (orphans.rows.length === 0) {
    console.log('\n✅ Aucun orphelin. Rien à faire.');
    await client.end();
    return;
  }

  // 2. Créer les profils manquants
  const result = await client.query(`
    INSERT INTO profiles (id, email, full_name, subscription_tier, subscription_status)
    SELECT DISTINCT
      s.user_id,
      'user-' || SUBSTRING(s.user_id::text, 1, 8) || '@a-renseigner.local',
      'Utilisateur à configurer',
      'PRO',
      'ACTIVE'
    FROM stores s
    LEFT JOIN profiles p ON p.id = s.user_id
    WHERE p.id IS NULL
    ON CONFLICT (email) DO NOTHING
  `);

  console.log(`\n✅ ${result.rowCount} profil(s) créé(s).`);

  // 3. Vérification
  const check = await client.query(`
    SELECT COUNT(*) AS remaining
    FROM stores s
    LEFT JOIN profiles p ON p.id = s.user_id
    WHERE p.id IS NULL
  `);

  const remaining = parseInt(check.rows[0].remaining);
  if (remaining === 0) {
    console.log('✅ Tous les stores ont maintenant un profil valide.');
  } else {
    console.log(`⚠️  ${remaining} orphelin(s) restant(s).`);
  }

  // 4. Lister les profils créés avec leur(s) boutique(s)
  const linked = await client.query(`
    SELECT p.id, p.email, p.full_name, s.name AS store_name
    FROM profiles p
    JOIN stores s ON s.user_id = p.id
    WHERE p.email LIKE '%@a-renseigner.local'
    ORDER BY p.email
  `);

  console.log('\n Profils à configurer (email à remplacer) :');
  for (const row of linked.rows) {
    console.log(`   ${row.email} → boutique "${row.store_name}"`);
  }

  await client.end();
}

main().catch((err) => {
  console.error('Erreur:', err.message);
  process.exit(1);
});
