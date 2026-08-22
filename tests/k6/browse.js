import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, extractProducts, extractStores } from './lib/utils.js';

const TARGET_VUS = Number(__ENV.VUS || 20);
const RAMP_UP = __ENV.RAMP_UP || '1m';
const PLATEAU = __ENV.PLATEAU || '3m';
const RAMP_DOWN = __ENV.RAMP_DOWN || '30s';

export const options = {
  scenarios: {
    browse: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: TARGET_VUS },
        { duration: PLATEAU, target: TARGET_VUS },
        { duration: RAMP_DOWN, target: 0 },
      ],
      gracefulRampDown: '15s',
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
  if (products.length === 0) {
    console.warn('Aucun produit détecté dans le payload RSC de la page d\'accueil.');
  }
  console.log(`Setup: ${products.length} produits, ${stores.length} boutiques.`);
  return { products, stores };
}

export default function (data) {
  group('accueil', () => {
    const res = http.get(`${BASE_URL}/`, { tags: { name: 'home' } });
    check(res, { 'accueil 200': (r) => r.status === 200 });
  });
  sleep(Math.random() * 2 + 1);

  group('fiche produit', () => {
    const target =
      data.products.length > 0
        ? data.products[Math.floor(Math.random() * data.products.length)]
        : '/';
    const res = http.get(`${BASE_URL}${target}`, { tags: { name: 'produit' } });
    check(res, { 'produit 200': (r) => r.status === 200 });
  });
  sleep(Math.random() * 3 + 1);

  group('boutique', () => {
    const target =
      data.stores.length > 0
        ? data.stores[Math.floor(Math.random() * data.stores.length)]
        : null;
    if (target) {
      const res = http.get(`${BASE_URL}${target}`, { tags: { name: 'boutique' } });
      check(res, { 'boutique 200': (r) => r.status === 200 });
    }
  });
  sleep(Math.random() * 2 + 1);
}
