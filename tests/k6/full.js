import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, extractProducts, extractStores } from './lib/utils.js';

const TARGET_VUS = Number(__ENV.VUS || 1000);
const DURATION = __ENV.DURATION || '3m';

export const options = {
  scenarios: {
    full: {
      executor: 'constant-vus',
      vus: TARGET_VUS,
      duration: DURATION,
    },
  },
  cloud: {
    name: `PosMarket full ${TARGET_VUS} VUs`,
    distribution: {
      afrique: { loadZone: 'amazon:sa:cape town', percent: 40 },
      europe: { loadZone: 'amazon:fr:paris', percent: 35 },
      'us-east': { loadZone: 'amazon:us:ashburn', percent: 25 },
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:accueil}': ['p(95)<3000'],
    'http_req_duration{name:produit}': ['p(95)<3000'],
    'http_req_duration{name:boutique}': ['p(95)<3000'],
    'http_req_duration{name:panier}': ['p(95)<3000'],
    'http_req_duration{name:login}': ['p(95)<3000'],
    'http_req_duration{name:cgv}': ['p(95)<3000'],
    'http_req_duration{name:confidentialite}': ['p(95)<3000'],
    'http_req_duration{name:api-ping}': ['p(95)<2000'],
    'http_req_duration{name:api-set-store}': ['p(95)<2000'],
  },
};

const LEGAL_ROUTES = ['/cgv', '/confidentialite'];

export function setup() {
  const res = http.get(`${BASE_URL}/`, { tags: { name: 'home [setup]' } });
  if (res.status !== 200) {
    console.error(`Accueil inaccessible (${res.status}).`);
    return { products: [], stores: [] };
  }
  const products = extractProducts(res.body);
  const stores = extractStores(res.body);
  console.log(`Setup: ${products.length} produits, ${stores.length} boutiques.`);
  return { products, stores };
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export default function (data) {
  const roll = Math.random();

  if (roll < 0.28) {
    group('accueil', () => {
      const res = http.get(`${BASE_URL}/`, { tags: { name: 'accueil' } });
      check(res, { 'accueil 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.53 && data.products.length > 0) {
    group('fiche produit', () => {
      const res = http.get(`${BASE_URL}${pick(data.products)}`, { tags: { name: 'produit' } });
      check(res, { 'produit 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.68 && data.stores.length > 0) {
    group('boutique', () => {
      const res = http.get(`${BASE_URL}${pick(data.stores)}`, { tags: { name: 'boutique' } });
      check(res, { 'boutique 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.8) {
    group('panier', () => {
      const res = http.get(`${BASE_URL}/cart`, { tags: { name: 'panier' } });
      check(res, { 'panier 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.88) {
    group('login', () => {
      const res = http.get(`${BASE_URL}/login`, { tags: { name: 'login' } });
      check(res, { 'login 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.93) {
    group('pages legales', () => {
      const res = http.get(`${BASE_URL}${pick(LEGAL_ROUTES)}`, { tags: { name: pick(LEGAL_ROUTES) === '/cgv' ? 'cgv' : 'confidentialite' } });
      check(res, { 'legale 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.97) {
    group('api ping (DB)', () => {
      const res = http.get(`${BASE_URL}/api/ping`, { tags: { name: 'api-ping' } });
      check(res, {
        'ping 200': (r) => r.status === 200,
        'ping ok:true': (r) => {
          try { return r.json('ok') === true; } catch (_) { return false; }
        },
      });
    });
  } else {
    group('api set-store', () => {
      const res = http.post(
        `${BASE_URL}/api/set-store`,
        JSON.stringify({ storeId: 'k6-full-test' }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'api-set-store' } },
      );
      check(res, {
        'set-store 200': (r) => r.status === 200,
        'set-store success': (r) => {
          try { return r.json('success') === true; } catch (_) { return false; }
        },
      });
    });
  }

  sleep(Math.random() * 2 + 0.5);
}
