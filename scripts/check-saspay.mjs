#!/usr/bin/env node
// Vérification en lecture seule des variables d'environnement SasPay.
// Les clés saisies uniquement dans l'admin ne sont pas lues par cette commande.
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const key = (process.env.SASPAY_API_KEY || '').trim();
const secret = (process.env.SASPAY_WEBHOOK_SECRET || '').trim();
const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
let valid = true;

if (!/^sk_(test|live)_\S+$/.test(key)) {
  console.error('SASPAY_API_KEY : absente ou invalide (sk_test_... / sk_live_...).');
  valid = false;
} else {
  console.log(`Clé API : format valide (${key.startsWith('sk_test_') ? 'test' : 'production'}).`);
}
if (!secret) {
  console.error('SASPAY_WEBHOOK_SECRET : absent.');
  valid = false;
} else {
  console.log('Secret de webhook : présent.');
}
try {
  const url = new URL(appUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error();
  console.log('URL publique HTTPS : configurée.');
} catch {
  console.error('APP_URL : URL publique HTTPS requise, sans chemin.');
  valid = false;
}
if (!valid) {
  console.error('Cette commande vérifie uniquement les variables serveur, pas les secrets saisis dans /pam/settings.');
  process.exitCode = 1;
} else {
  async function check(path, authenticated) {
    try {
      const response = await fetch(`https://api.saspay.me/api/v1${path}`, {
        headers: authenticated ? { Authorization: `Bearer ${key}`, Accept: 'application/json' } : { Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) {
        console.error(`${path} : HTTP ${response.status}. Vérifiez la configuration ou patientez en cas de 429.`);
        return false;
      }
      console.log(`${path} : accessible.`);
      return true;
    } catch {
      console.error(`${path} : connexion impossible.`);
      return false;
    }
  }
  const countries = await check('/countries/', false);
  const rates = await check('/pricing/my-rates/', true);
  if (!countries || !rates) process.exitCode = 1;
}
