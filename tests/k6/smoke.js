import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './lib/utils.js';

export const options = {
  vus: 1,
  iterations: 1,
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<6000'],
  },
};

const ROUTES = ['/', '/cart', '/login', '/cgv', '/confidentialite'];

export default function () {
  for (const route of ROUTES) {
    const res = http.get(`${BASE_URL}${route}`, { tags: { name: route } });
    check(res, {
      [`${route} -> 200`]: (r) => r.status === 200,
      [`${route} -> contenu non vide`]: (r) => r.body && r.body.length > 500,
    });
  }
}
