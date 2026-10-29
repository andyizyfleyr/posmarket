import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { PgDialect } from 'drizzle-orm/pg-core';
import { saspayApprovalQuery } from '../../src/lib/saspayApproval.ts';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ROW = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ROW_2 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CHECKOUT = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const CHECKOUT_2 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
const PAYMENT = '12345678-1234-4234-8234-123456789abc';

async function setup(t) {
  const pg = new PGlite();
  t.after(async () => pg.close());
  await pg.exec(`
    CREATE TABLE profiles (
      id uuid PRIMARY KEY,
      subscription_tier text,
      subscription_duration text,
      subscription_status text,
      subscription_start_date timestamp,
      subscription_end_date timestamp
    );
    CREATE TABLE subscription_payments (
      id uuid PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES profiles(id),
      tier text NOT NULL,
      duration text NOT NULL,
      transaction_id text UNIQUE,
      reference text,
      status text NOT NULL DEFAULT 'PENDING',
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);
  const migration = await readFile(new URL('../../drizzle/0025_saspay_subscriptions.sql', import.meta.url), 'utf8');
  await pg.exec(migration);
  await pg.exec(migration); // migration réapplicable
  return pg;
}

function query(values) {
  return new PgDialect().sqlToQuery(saspayApprovalQuery(values));
}

test('approbation atomique, concurrence et unicité PostgreSQL', async t => {
  const pg = await setup(t);
  await pg.query('INSERT INTO profiles (id) VALUES ($1), ($2)', [USER, USER_2]);
  await pg.query(`INSERT INTO subscription_payments
    (id, user_id, tier, duration, transaction_id, provider, saspay_checkout_id)
    VALUES ($1, $2, 'STARTER', 'monthly', 'invoice-1', 'saspay', $3),
           ($4, $5, 'PRO', 'annual', 'invoice-2', 'saspay', $6)`,
  [ROW, USER, CHECKOUT, ROW_2, USER_2, CHECKOUT_2]);

  const values = { rowId: ROW, checkoutId: CHECKOUT, paymentId: PAYMENT, charged: '12300.00', net: '12000.00', feeMode: 'ADD_ON' };
  const compiled = query(values);
  const results = await Promise.all([
    pg.query(compiled.sql, compiled.params),
    pg.query(compiled.sql, compiled.params),
  ]);
  assert.deepEqual(results.map(result => result.rows.length).sort(), [0, 1]);
  const initialProfile = (await pg.query('SELECT * FROM profiles WHERE id = $1', [USER])).rows[0];
  const approved = (await pg.query('SELECT * FROM subscription_payments WHERE id = $1', [ROW])).rows[0];
  assert.equal(initialProfile.subscription_status, 'ACTIVE');
  assert.equal(initialProfile.subscription_tier, 'STARTER');
  assert.equal(approved.status, 'APPROVED');
  assert.equal(approved.saspay_payment_id, PAYMENT);
  assert.equal(approved.saspay_charged_amount, '12300.00');
  assert.equal(approved.saspay_net_amount, '12000.00');
  assert.equal(approved.saspay_fee_charge_mode, 'ADD_ON');

  // Rejeu : ni la date de début ni la date d'expiration ne sont réinitialisées.
  await pg.query(compiled.sql, compiled.params);
  const replayProfile = (await pg.query('SELECT * FROM profiles WHERE id = $1', [USER])).rows[0];
  assert.deepEqual(replayProfile, initialProfile);

  // Une session différente et une facture déjà traitée ne peuvent pas être approuvées.
  const wrongCheckout = query({ ...values, rowId: ROW_2 });
  assert.equal((await pg.query(wrongCheckout.sql, wrongCheckout.params)).rows.length, 0);

  // Même transaction distante sur deux factures : l'index unique fait échouer
  // toute l'instruction et le second profil n'est pas activé.
  const reuse = query({ ...values, rowId: ROW_2, checkoutId: CHECKOUT_2 });
  await assert.rejects(pg.query(reuse.sql, reuse.params));
  const secondPayment = (await pg.query('SELECT status FROM subscription_payments WHERE id = $1', [ROW_2])).rows[0];
  const secondProfile = (await pg.query('SELECT subscription_status FROM profiles WHERE id = $1', [USER_2])).rows[0];
  assert.equal(secondPayment.status, 'PENDING');
  assert.equal(secondProfile.subscription_status, null);

  // Défense supplémentaire si une ancienne base contient une facture orpheline
  // (la migration historique prévoit normalement une clé étrangère).
  await pg.exec('ALTER TABLE subscription_payments DROP CONSTRAINT subscription_payments_user_id_fkey');
  const orphanRow = '11111111-1111-4111-8111-111111111111';
  const orphanUser = '22222222-2222-4222-8222-222222222222';
  const orphanCheckout = '33333333-3333-4333-8333-333333333333';
  const orphanPayment = '44444444-4444-4444-8444-444444444444';
  await pg.query(`INSERT INTO subscription_payments
    (id, user_id, tier, duration, transaction_id, provider, saspay_checkout_id)
    VALUES ($1, $2, 'PRO', 'monthly', 'orphan', 'saspay', $3)`, [orphanRow, orphanUser, orphanCheckout]);
  const orphan = query({ ...values, rowId: orphanRow, checkoutId: orphanCheckout, paymentId: orphanPayment });
  assert.equal((await pg.query(orphan.sql, orphan.params)).rows.length, 0);
  assert.equal((await pg.query('SELECT status FROM subscription_payments WHERE id = $1', [orphanRow])).rows[0].status, 'PENDING');
});
