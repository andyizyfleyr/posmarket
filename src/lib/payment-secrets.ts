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
 * Sans clé configurée, aucune écriture de secret n'est possible : on préfère
 * refuser l'activation plutôt que stocker une clé en clair.
 */

const VERSION = 'v1';
const IV_BYTES = 12;
const TAG_BYTES = 16;

function resolveKey(): Buffer {
  const raw = (process.env.PAYMENT_CREDENTIALS_KEY || '').trim();
  if (!raw) {
    throw new Error(
      'PAYMENT_CREDENTIALS_KEY est absent : impossible de chiffrer les clés de paiement.',
    );
  }
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const asBase64 = Buffer.from(raw, 'base64');
  if (asBase64.length === 32) return asBase64;
  return createHash('sha256').update(raw).digest();
}

export function paymentCredentialsKeyConfigured(): boolean {
  return Boolean((process.env.PAYMENT_CREDENTIALS_KEY || '').trim());
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
