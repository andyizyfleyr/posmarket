import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * Chiffrement au repos des secrets d'encaissement des boutiques.
 *
 * Le format est `v1:<iv base64url>:<tag base64url>:<ciphertext base64url>`.
 * La clé provient de `PAYMENT_CREDENTIALS_KEY` :
 *   - 64 caractères hexadécimaux, ou
 *   - 32 octets encodés en base64, ou
 *   - toute autre chaîne, dérivée en SHA-256 (pratique pour une passphrase).
 *
 * À défaut, une clé dédiée est dérivée de `AUTH_SECRET` / `NEXTAUTH_SECRET`
 * avec un contexte de dérivation propre (jamais la clé de session elle-même).
 * Sans aucun secret dans l'environnement, aucune écriture de secret n'est
 * possible : on préfère refuser plutôt que stocker une clé en clair.
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;
// Séparation des usages : la clé de paiement n'est jamais la clé de session,
// même dérivée. Seul un contexte dédié relie les deux.
const DERIVATION_CONTEXT = 'posmarket:payment-credentials:v1';

let warnedFallback = false;

function fallbackSecret(): string {
  return (process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '').trim();
}

/**
 * Résolution de la clé maître :
 * 1. `PAYMENT_CREDENTIALS_KEY` (hex 64, base64 32 octets, ou passphrase) — la
 *    configuration recommandée, isolée du reste ;
 * 2. repli : une clé dédiée dérivée de `AUTH_SECRET` / `NEXTAUTH_SECRET` avec
 *    un contexte de dérivation propre. Stable entre redéploiements, jamais
 *    stockée en base, et suffisante tant que le secret de session est
 *    protégé — mais moins isolée qu'une clé dédiée, d'où l'avertissement ;
 * 3. sans aucun secret : refus explicite.
 */
function resolveKey(): Buffer {
  const raw = (process.env.PAYMENT_CREDENTIALS_KEY || '').trim();
  if (raw) {
    if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
    const asBase64 = Buffer.from(raw, 'base64');
    if (asBase64.length === 32) return asBase64;
    return createHash('sha256').update(raw).digest();
  }
  const fallback = fallbackSecret();
  if (fallback) {
    if (!warnedFallback) {
      console.warn(
        '[payments] PAYMENT_CREDENTIALS_KEY absente : secrets de paiement chiffrés avec une clé dérivée de AUTH_SECRET. Définissez PAYMENT_CREDENTIALS_KEY pour isoler cette clé (`node scripts/generate-payment-key.mjs`).',
      );
      warnedFallback = true;
    }
    return createHash('sha256').update(`${DERIVATION_CONTEXT}:${fallback}`).digest();
  }
  throw new Error(
    'PAYMENT_CREDENTIALS_KEY est absente. Générez une clé avec `node scripts/generate-payment-key.mjs`, définissez-la dans l’environnement serveur, puis redéployez.',
  );
}

export function paymentCredentialsKeyConfigured(): boolean {
  return Boolean((process.env.PAYMENT_CREDENTIALS_KEY || '').trim() || fallbackSecret());
}

export function encryptPaymentSecret(payload: Record<string, unknown>): string {
  const key = resolveKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptPaymentSecret<T = Record<string, unknown>>(value: string): T {
  const parts = String(value || '').split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('Secret de paiement illisible.');
  }
  const [, ivPart, tagPart, dataPart] = parts;
  const key = resolveKey();
  const iv = Buffer.from(ivPart, 'base64url');
  const tag = Buffer.from(tagPart, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Secret de paiement corrompu.');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}
