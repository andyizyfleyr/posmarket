#!/usr/bin/env node
/**
 * Génère une clé PAYMENT_CREDENTIALS_KEY pour chiffrer les secrets de
 * paiement des boutiques.
 *
 * Usage :
 *   node scripts/generate-payment-key.mjs
 *
 * Copiez la ligne affichée dans l'environnement serveur (Vercel → Settings →
 * Environment Variables, ou .env.local en développement), puis redéployez.
 */
import { randomBytes } from 'node:crypto';

const key = randomBytes(32).toString('hex');

console.log('Définissez cette variable dans l’environnement serveur :\n');
console.log(`PAYMENT_CREDENTIALS_KEY=${key}`);
console.log('\n32 octets aléatoires, encodés hexadécimaux (format accepté tel quel).');
