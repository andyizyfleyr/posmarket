import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL } from './lib/utils.js';

const CHECKOUT_ACTION_ID = __ENV.CHECKOUT_ACTION_ID || '';

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    'http_req_duration{name:checkout-action}': ['p(95)<1000'],
    'http_req_duration{name:set-store}': ['p(95)<500'],
  },
};

export default function () {
  const params = {
    headers: { 'Content-Type': 'application/json' },
  };

  const storeRes = http.post(
    `${BASE_URL}/api/set-store`,
    JSON.stringify({ storeId: 'k6-load-test' }),
    { ...params, tags: { name: 'set-store' } },
  );
  check(storeRes, {
    'set-store 200': (r) => r.status === 200,
  });
  sleep(1);

  if (!CHECKOUT_ACTION_ID) return;

  const order = {
    items: [{ productId: 'k6-load-test', quantity: 1, price: 1000 }],
    total: 1000,
    customer: { name: 'K6 LoadTest', phone: '+221000000000' },
  };
  const res = http.post(
    `${BASE_URL}/cart`,
    JSON.stringify([order]),
    {
      headers: {
        'Content-Type': 'application/json',
        'Next-Action': CHECKOUT_ACTION_ID,
      },
      tags: { name: 'checkout-action' },
    },
  );
  check(res, {
    'checkout 200': (r) => r.status === 200,
    'checkout réponse action': (r) => r.body && r.body.length > 0,
  });
  sleep(1);
}

export function handleSummary(data) {
  if (CHECKOUT_ACTION_ID) return {};
  const skipped = data.metrics.http_reqs.values.count === 0;
  return {
    stdout: `\n${
      skipped
        ? 'ℹ️  Test checkout ignoré : variable CHECKOUT_ACTION_ID non définie.\n   Récupère l\'ID via DevTools (onglet Network → requête POST du checkout → header "Next-Action")\n   puis relance avec : k6 run -e CHECKOUT_ACTION_ID=<id> tests/k6/writes.js\n'
        : ''
  }\nTests d\'écriture terminés.\n`,
  };
}
