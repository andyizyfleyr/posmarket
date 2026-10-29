import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  createSaspayCheckout,
  findSaspayCheckoutForPayment,
  getSaspayCheckoutStatus,
  normalizeSaspayAmount,
  publicSaspayError,
  saspayPaymentMatches,
  saspayReturnUrl,
  SaspayApiError,
  verifySaspayPayment,
  verifySaspayWebhookSignature,
} from '../../src/lib/saspay.ts';

const SESSION = 'c9a17e2c-4b1a-4f0e-9c3d-2a1b3c4d5e6f';
const PAYMENT = '9c3f2a10-4b7e-4f1a-9d2e-9b6a7c1e4a02';
const INVOICE = '3fa85f64-5717-4562-b3fc-2c963f66afa6';
const KEY = 'sk_test_fake_for_unit_tests';

function envelope(data, status = 200) {
  return new Response(JSON.stringify({ success: true, data, code: status }), { status });
}

test('signature webhook : corps brut, horodatage, secret et anti-rejeu', () => {
  const secret = 'fake-webhook-secret';
  const timestamp = '1780000000';
  const raw = Buffer.from('{ "event": "transaction.success",\n"data": {"id": "é"}}');
  const signature = createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  const valid = (body = raw, sig = signature, ts = timestamp, key = secret, now = Number(timestamp)) =>
    verifySaspayWebhookSignature(body, sig, ts, key, now);

  assert.equal(valid(), true);
  assert.equal(valid(raw, signature, timestamp, secret, Number(timestamp) + 300), true);
  assert.equal(valid(raw, signature, timestamp, secret, Number(timestamp) + 301), false);
  assert.equal(valid(raw, signature, timestamp, secret, Number(timestamp) - 301), false);
  assert.equal(valid(Buffer.from(raw.toString().replace('é', 'e'))), false);
  assert.equal(valid(raw, signature.toUpperCase()), false);
  assert.equal(valid(raw, signature, 'NaN'), false);
  assert.equal(valid(raw, signature, ''), false);
  assert.equal(valid(raw, signature, timestamp, ''), false);
  assert.equal(valid(raw, null), false);
});

test('le retour et le webhook ne suffisent pas à approuver un paiement', () => {
  const session = { id: SESSION, status: 'PAID', transaction_id: PAYMENT, transaction_status: 'SUCCESS' };
  const payment = {
    id: PAYMENT, status: 'SUCCESS', requested_amount: '12000.00', currency: 'XOF',
    flow_direction: 'INBOUND', transaction_type: 'PAIEMENT',
    debited_amount: '12300.00', net_amount: '12000.00', fee_charge_mode: 'ADD_ON',
  };
  const expected = { sessionId: SESSION, amount: 12000, currency: 'XOF', paymentId: PAYMENT };
  assert.equal(saspayPaymentMatches(session, payment, expected), true);
  for (const invalid of [
    { ...payment, status: 'PENDING' },
    { ...payment, status: 'FAILED' },
    { ...payment, requested_amount: '11999.99' },
    { ...payment, requested_amount: 12000 },
    { ...payment, requested_amount: undefined },
    { ...payment, currency: 'XAF' },
    { ...payment, currency: undefined },
    { ...payment, id: INVOICE },
    { ...payment, flow_direction: 'OUTBOUND' },
    { ...payment, transaction_type: 'PAYOUT' },
  ]) assert.equal(saspayPaymentMatches(session, invalid, expected), false);
  assert.equal(saspayPaymentMatches({ ...session, status: 'PENDING' }, payment, expected), false);
  assert.equal(saspayPaymentMatches({ ...session, transaction_status: 'FAILED' }, payment, expected), false);
  assert.equal(saspayPaymentMatches({ ...session, transaction_id: INVOICE }, payment, expected), false);
  assert.equal(saspayPaymentMatches(session, payment, { ...expected, sessionId: INVOICE }), false);
  assert.equal(saspayPaymentMatches(session, payment, { ...expected, paymentId: INVOICE }), false);
  assert.equal(saspayPaymentMatches(session, payment, { ...expected, amount: 0 }), false);

  assert.equal(normalizeSaspayAmount('0012000.0'), '12000.00');
  assert.equal(normalizeSaspayAmount('12000'), '12000.00');
  for (const invalid of [12000, '-1.00', '1.001', '1e3', '', null]) assert.equal(normalizeSaspayAmount(invalid), null);
});

test('checkout serveur, statuts API enveloppés, URL autorisée et erreurs sans fuite', async t => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  const input = {
    amount: 12000, transactionId: INVOICE, tier: 'STARTER', duration: 'monthly',
    customerEmail: 'client@example.test', customerName: 'Client Test',
    returnUrl: `https://shop.example.test/subscription?saspay=return&payment=${INVOICE}`,
  };

  await t.test('création : chaîne décimale, clé sur serveur, pas de retry ni de clé d’idempotence', async () => {
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.saspay.me/api/v1/checkout-sessions/');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, `Bearer ${KEY}`);
      assert.equal(options.headers['Idempotency-Key'], undefined);
      const sent = JSON.parse(options.body);
      assert.equal(sent.amount, '12000.00');
      assert.equal(sent.currency, 'XOF');
      assert.equal(sent.return_url, input.returnUrl);
      assert.equal(sent.metadata.posmarket_payment_id, INVOICE);
      return envelope({ id: SESSION, checkout_url: 'https://pay.saspay.me/checkout/abc' }, 201);
    };
    const result = await createSaspayCheckout(KEY, input);
    assert.deepEqual(result, { id: SESSION, checkoutUrl: 'https://pay.saspay.me/checkout/abc' });
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(result).includes(KEY), false);
  });

  await t.test('refuse une URL ou un identifiant de session forgé', async () => {
    for (const url of ['https://pay.saspay.me.evil.test/checkout', 'http://pay.saspay.me/checkout', 'https://evil@pay.saspay.me/checkout']) {
      globalThis.fetch = async () => envelope({ id: SESSION, checkout_url: url });
      await assert.rejects(createSaspayCheckout(KEY, input), SaspayApiError);
    }
    globalThis.fetch = async () => envelope({ id: 'not-uuid', checkout_url: 'https://pay.saspay.me/checkout/abc' });
    await assert.rejects(createSaspayCheckout(KEY, input), SaspayApiError);
  });

  await t.test('la session fournit la transaction puis verify confirme son montant et sa devise', async () => {
    const urls = [];
    globalThis.fetch = async url => {
      urls.push(url);
      if (url.endsWith('/status/')) return envelope({ id: SESSION, status: 'PAID', transaction_id: PAYMENT, transaction_status: 'SUCCESS' });
      return envelope({ id: PAYMENT, status: 'SUCCESS', requested_amount: '12000.00', currency: 'XOF' });
    };
    const session = await getSaspayCheckoutStatus(KEY, SESSION);
    const payment = await verifySaspayPayment(KEY, session.transaction_id);
    assert.equal(saspayPaymentMatches(session, payment, { sessionId: SESSION, amount: 12000, currency: 'XOF' }), true);
    assert.deepEqual(urls, [
      `https://api.saspay.me/api/v1/checkout-sessions/${SESSION}/status/`,
      `https://api.saspay.me/api/v1/payments/${PAYMENT}/verify/`,
    ]);
  });

  await t.test('recherche la transaction du webhook uniquement dans les sessions payées', async () => {
    globalThis.fetch = async url => {
      assert.equal(url, 'https://api.saspay.me/api/v1/checkout-sessions/?status=PAID&page=1&page_size=100');
      return envelope({ results: [{ id: SESSION, transaction: PAYMENT, metadata: { posmarket_payment_id: INVOICE } }] });
    };
    assert.deepEqual(await findSaspayCheckoutForPayment(KEY, PAYMENT), { id: SESSION, localTransactionId: INVOICE });
    assert.equal(await findSaspayCheckoutForPayment(KEY, INVOICE), null);
  });

  await t.test('erreurs 401, 403, 422 et 429 : messages publics sans secret', async () => {
    for (const code of [400, 401, 403, 422, 429, 500]) {
      let calls = 0;
      globalThis.fetch = async () => {
        calls++;
        return new Response(JSON.stringify({ success: false, error: { message: KEY }, code }), { status: code });
      };
      await assert.rejects(createSaspayCheckout(KEY, input), error => {
        assert.equal(error.status, code);
        assert.equal(publicSaspayError(error).includes(KEY), false);
        return true;
      });
      assert.equal(calls, 1);
    }
    assert.equal(publicSaspayError(new Error(KEY)).includes(KEY), false);
  });
});

test('URL de retour : uniquement origine HTTPS configurée côté serveur', t => {
  const previous = process.env.APP_URL;
  const previousSite = process.env.NEXT_PUBLIC_SITE_URL;
  t.after(() => {
    if (previous === undefined) delete process.env.APP_URL; else process.env.APP_URL = previous;
    if (previousSite === undefined) delete process.env.NEXT_PUBLIC_SITE_URL; else process.env.NEXT_PUBLIC_SITE_URL = previousSite;
  });
  process.env.APP_URL = 'https://shop.example.test';
  assert.equal(saspayReturnUrl(INVOICE), `https://shop.example.test/subscription?saspay=return&payment=${INVOICE}`);
  for (const invalid of ['http://shop.example.test', 'https://shop.example.test/path', 'https://user:pass@shop.example.test', 'https://shop.example.test/?x=1']) {
    process.env.APP_URL = invalid;
    assert.throws(() => saspayReturnUrl(INVOICE));
  }
});
