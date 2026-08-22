import http from 'k6/http';

export const BASE_URL = (__ENV.BASE_URL || 'https://posmarket-topaz.vercel.app').replace(/\/+$/, '');

function toProductSlug(name, id) {
  const clean = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${clean}-${id.split('-')[0]}`;
}

export function extractProducts(html) {
  const seen = new Set();
  const links = [];
  const re =
    /\\"id\\":\\"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\",\\"name\\":\\"(.*?)\\",\\"price\\":/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = `/product/${toProductSlug(m[2], m[1])}`;
    if (!seen.has(path)) {
      seen.add(path);
      links.push(path);
    }
  }
  return links;
}

export function extractStores(html) {
  const seen = new Set();
  const links = [];
  const re = /\\"slug\\":\\"([^\\"]+)\\"/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const path = `/store/${m[1]}`;
    if (!seen.has(path)) {
      seen.add(path);
      links.push(path);
    }
  }
  return links;
}
