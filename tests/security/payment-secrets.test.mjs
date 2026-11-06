import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, createHash } from 'node:crypto';

/**
 * Chiffrement des secrets de paiement (src/lib/payment-secrets.ts).
 *
 * L'application doit fonctionner sans PAYMENT_CREDENTIALS_KEY tant qu'un
 * secret de session existe (AUTH_SECRET / NEXTAUTH_SECRET) : une clé dédiée
 * est alors dérivée avec un contexte propre. Sans aucun secret, le chiffrement
 * DOIT refuser — jamais de repli silencieux en clair.
 */

// La résolution de la clé se fait à CHAQUE appel (pas à l'import) : un seul
// module suffit, les tests font varier process.env autour des opérations.
const mod = await import('../../src/lib/payment-secrets.ts');

/** Applique un environnement contrôlé pour la durée de `fn` (synchrone). */
function withEnv(env, fn) {
  const saved = {
    PAYMENT_CREDENTIALS_KEY: process.env.PAYMENT_CREDENTIALS_KEY,
    AUTH_SECRET: process.env.AUTH_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  };
  delete process.env.PAYMENT_CREDENTIALS_KEY;
  delete process.env.AUTH_SECRET;
  delete process.env.NEXTAUTH_SECRET;
  Object.assign(process.env, env);
  try {
    return fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('PAYMENT_CREDENTIALS_KEY hexadécimale : aller-retour encrypt/decrypt', () =>
  withEnv({ PAYMENT_CREDENTIALS_KEY: 'a'.repeat(64) }, () => {
    const payload = { apiKey: 'sk_live_abc123', webhookSecret: 'wh_live_xyz' };
    const encrypted = mod.encryptPaymentSecret(payload);
    assert.match(encrypted, /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
    assert.deepEqual(mod.decryptPaymentSecret(encrypted), payload);
  }));

test('repli dérivé de AUTH_SECRET : fonctionne et est stable entre appels', () =>
  withEnv({ AUTH_SECRET: 'session-secret-for-tests-0123456789' }, () => {
    const payload = { privateKey: 'sk_live_priv', secretKey: 'sk_live_sec' };
    const encrypted = mod.encryptPaymentSecret(payload);
    assert.match(encrypted, /^v1:/);
    // Deux chiffrements indépendants se déchiffrent tous deux.
    const encrypted2 = mod.encryptPaymentSecret(payload);
    assert.deepEqual(mod.decryptPaymentSecret(encrypted), payload);
    assert.deepEqual(mod.decryptPaymentSecret(encrypted2), payload);
  }));

test('repli dérivé : la clé dérivée N’EST PAS le secret AUTH_SECRET brut', () =>
  withEnv({ AUTH_SECRET: 'session-secret-for-tests-0123456789' }, () => {
    const encrypted = mod.encryptPaymentSecret({ apiKey: 'sk_live_abc' });
    // Un déchiffrement naïf avec createHash('sha256')(AUTH_SECRET) seul doit
    // ÉCHOUER : la séparation de contexte est obligatoire.
    const naiveKey = createHash('sha256').update('session-secret-for-tests-0123456789').digest();
    const [, iv, tag, data] = encrypted.split(':');
    assert.throws(() => {
      const decipher = createDecipheriv('aes-256-gcm', naiveKey, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]);
    });
  }));

test('sans aucun secret dans l’environnement : refus explicite', () =>
  withEnv({}, () => {
    assert.equal(mod.paymentCredentialsKeyConfigured(), false);
    assert.throws(() => mod.encryptPaymentSecret({ apiKey: 'sk_live_abc' }), /PAYMENT_CREDENTIALS_KEY/);
  }));

test('paymentCredentialsKeyConfigured reflète les deux sources possibles', () => {
  assert.equal(withEnv({ PAYMENT_CREDENTIALS_KEY: 'a'.repeat(64) }, () => mod.paymentCredentialsKeyConfigured()), true);
  assert.equal(withEnv({ NEXTAUTH_SECRET: 'legacy-secret-0123456789abcdef' }, () => mod.paymentCredentialsKeyConfigured()), true);
  assert.equal(withEnv({}, () => mod.paymentCredentialsKeyConfigured()), false);
});

test('une clé PAYMENT_CREDENTIALS_KEY présente prime sur AUTH_SECRET', () => {
  const encryptedWithAuthFallback = withEnv({ AUTH_SECRET: 'auth-secret-primacy-test-0123456789' }, () =>
    mod.encryptPaymentSecret({ apiKey: 'sk_live_abc' }));
  // La clé dédiée étant différente, le payload chiffré sous le repli est
  // illisible : la clé dédiée est la source de vérité dès qu'elle existe.
  withEnv({ AUTH_SECRET: 'auth-secret-primacy-test-0123456789', PAYMENT_CREDENTIALS_KEY: 'b'.repeat(64) }, () =>
    assert.throws(() => mod.decryptPaymentSecret(encryptedWithAuthFallback)));
});

test('payload altéré : le tag GCM fait échouer le déchiffrement', () =>
  withEnv({ PAYMENT_CREDENTIALS_KEY: 'a'.repeat(64) }, () => {
    const encrypted = mod.encryptPaymentSecret({ apiKey: 'sk_live_abc' });
    const parts = encrypted.split(':');
    const raw = Buffer.from(parts[3], 'base64url');
    raw[0] = raw[0] ^ 0xff;
    parts[3] = raw.toString('base64url');
    assert.throws(() => mod.decryptPaymentSecret(parts.join(':')));
  }));

test('format v1 invalide : refus propre', () =>
  withEnv({ PAYMENT_CREDENTIALS_KEY: 'a'.repeat(64) }, () => {
    assert.throws(() => mod.decryptPaymentSecret('not:a:valid:payload:value'));
    assert.throws(() => mod.decryptPaymentSecret('v2:a:b:c'));
  }));
