import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, extractProducts, extractStores } from './lib/utils.js';

const TARGET_VUS = Number(__ENV.VUS || 100);
const DURATION = __ENV.DURATION || '2m';

export const options = {
  scenarios: {
    spike: {
      executor: 'constant-vus',
      vus: TARGET_VUS,
      duration: DURATION,
      startTime: '0s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:home}': ['p(95)<600'],
    'http_req_duration{name:produit}': ['p(95)<800'],
    'http_req_duration{name:boutique}': ['p(95)<800'],
  },
};

export function setup() {
  const res = http.get(`${BASE_URL}/`, { tags: { name: 'home [setup]' } });
  if (res.status !== 200) {
    console.error(`Accueil inaccessible (${res.status}) — abort du setup.`);
    return { products: [], stores: [] };
  }
  const products = extractProducts(res.body);
  const stores = extractStores(res.body);
  console.log(`Setup: ${products.length} produits, ${stores.length} boutiques.`);
  return { products, stores };
}

export default function (data) {
  const roll = Math.random();

  if (roll < 0.5 || data.products.length === 0) {
    group('accueil', () => {
      const res = http.get(`${BASE_URL}/`, { tags: { name: 'home' } });
      check(res, { 'accueil 200': (r) => r.status === 200 });
    });
  } else if (roll < 0.85) {
    group('fiche produit', () => {
      const target = data.products[Math.floor(Math.random() * data.products.length)];
      const res = http.get(`${BASE_URL}${target}`, { tags: { name: 'produit' } });
      check(res, { 'produit 200': (r) => r.status === 200 });
    });
  } else {
    group('boutique', () => {
      const target = data.stores[Math.floor(Math.random() * data.stores.length)];
      const res = http.get(`${BASE_URL}${target}`, { tags: { name: 'boutique' } });
      check(res, { 'boutique 200': (r) => r.status === 200 });
    });
  }
  sleep(Math.random() * 3 + 1);
}
