import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

/**
 * Rejeu PGlite (PostgreSQL WASM) des migrations réelles touchant les tables
 * store_payment_*. Régression de l'incident « Impossible d'enregistrer ce
 * moyen de paiement. » : la contrainte CHECK créée par 0034 listait les
 * providers connus sans « feexpay » (SQLSTATE 23514 côté serveur).
 *
 * Ce test rejoue exactement les fichiers que l'installateur exécute :
 *   1. 0034 seul  → l'insertion « feexpay » DOIT être refusée (bug d'origine) ;
 *   2. après 0035 → « feexpay » accepté, historique conservé, inconnus refusés.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const STORE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

test('0035_feexpay_provider : feexpay accepté, historique conservé, inconnus refusés', async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      CREATE TABLE stores (id uuid PRIMARY KEY, name text);
      CREATE TABLE orders (id uuid PRIMARY KEY);
    `);
    await pg.exec(await readFile(path.join(root, 'drizzle/0034_store_payments.sql'), 'utf8'));

    // 1. L'état d'avant 0035 refuse bien « feexpay » (cause racine de l'incident).
    await assert.rejects(
      pg.query(
        `INSERT INTO store_payment_methods (store_id, provider, enabled) VALUES ($1, 'feexpay', true)`,
        [STORE],
      ),
      /store_payment_methods_provider_check/,
    );

    // 2. La migration corrige les deux contraintes.
    await pg.exec(await readFile(path.join(root, 'drizzle/0035_feexpay_provider.sql'), 'utf8'));
    // Rejouer 0035 ne casse rien (idempotente).
    await pg.exec(await readFile(path.join(root, 'drizzle/0035_feexpay_provider.sql'), 'utf8'));

    await pg.query(`INSERT INTO stores (id, name) VALUES ($1, 'Boutique test')`, [STORE]);
    await pg.query(
      `INSERT INTO store_payment_methods (store_id, provider, enabled) VALUES ($1, 'feexpay', true)`,
      [STORE],
    );
    await pg.query(
      `INSERT INTO store_payment_credentials (store_id, provider, payload) VALUES ($1, 'feexpay', 'v1:a:b:c')`,
      [STORE],
    );
    // Historique toujours accepté.
    await pg.query(
      `INSERT INTO store_payment_methods (store_id, provider, enabled) VALUES ($1, 'cod', true)`,
      [STORE],
    );
    await pg.query(
      `INSERT INTO store_payment_methods (store_id, provider, enabled) VALUES ($1, 'kkiapay', true)`,
      [STORE],
    );
    // Toujours refusé : provider inconnu, et cod dans les credentials (sans secrets).
    await assert.rejects(
      pg.query(
        `INSERT INTO store_payment_methods (store_id, provider, enabled) VALUES ($1, 'bitcoin', true)`,
        [STORE],
      ),
      /store_payment_methods_provider_check/,
    );
    await assert.rejects(
      pg.query(
        `INSERT INTO store_payment_credentials (store_id, provider, payload) VALUES ($1, 'cod', 'v1:a:b:c')`,
        [STORE],
      ),
      /store_payment_credentials_provider_check/,
    );
  } finally {
    await pg.close();
  }
});
