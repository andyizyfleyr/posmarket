#!/usr/bin/env node
// Seed du compte administrateur racine de l'espace PAM.
// Usage:
//   npm run db:seed:admin -- -u monadmin -p 'mot-de-passe-fort' -e admin@domaine.com -n "Nom Admin"
//
// Idempotent : si un admin avec ce username existe, il est mis à jour ;
// le premier compte créé devient automatiquement root.
import { neon } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

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

function arg(name) {
  const i = process.argv.indexOf(`-${name}`);
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return undefined;
}

async function main() {
  const username = (arg('u') || process.env.ADMIN_SEED_USERNAME || '').trim();
  const password = arg('p') || process.env.ADMIN_SEED_PASSWORD || '';
  const email = (arg('e') || process.env.ADMIN_SEED_EMAIL || '').trim();
  const displayName = (arg('n') || username).trim();

  if (!username || !password) {
    console.error('Usage: npm run db:seed:admin -- -u <username> -p <password> [-e <email>] [-n <name>]');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Le mot de passe doit faire au moins 8 caractères.');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL introuvable dans .env.local');
    process.exit(1);
  }

  const sql = neon(url);

  const hash = await bcrypt.hash(password, 12);

  const existing = await sql`SELECT id, is_root, email FROM admin_users WHERE username = ${username} LIMIT 1`;

  if (existing.length > 0) {
    await sql`
      UPDATE admin_users
      SET password_hash = ${hash},
          email = ${email && email.length ? email : existing[0].email},
          display_name = ${displayName}, is_active = true
      WHERE username = ${username}
    `;
    console.log(`✔ Compte admin mis à jour : ${username}`);
  } else {
    const count = await sql`SELECT COUNT(*)::int AS n FROM admin_users`;
    const isRoot = count[0].n === 0;
    await sql`
      INSERT INTO admin_users (username, email, password_hash, display_name, is_root, is_active)
      VALUES (${username}, ${email || `${username}@pam.local`}, ${hash}, ${displayName}, ${isRoot}, true)
    `;
    console.log(`✔ Compte admin créé : ${username}${isRoot ? ' (root)' : ''}`);
  }

  if (email) console.log(`   Email : ${email}`);
  console.log(`   Espace : https://<votre-domaine>/pam`);
  console.log('   Conservez ces identifiants en lieu sûr.');
}

main().catch((e) => {
  console.error('Erreur:', e.message || e);
  process.exit(1);
});
