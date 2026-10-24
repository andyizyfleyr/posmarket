/**
 * Téléchargement groupé des images produits (ZIP).
 *
 * Ce module contient la logique « pure » : lecture des sources d'images d'un
 * produit, récupération sécurisée des octets (data URI ou URL distante),
 * nommage des fichiers et manifeste CSV. La partie base de données vit dans
 * `product-images-server.ts`, la génération du ZIP dans `zip.ts`.
 *
 * Deux contraintes ont guidé l'implémentation :
 *
 * 1. **Sécurité** — une URL d'image est saisie par le vendeur : la récupérer
 *    côté serveur ouvre une porte SSRF (métadonnées cloud, réseau interne).
 *    On refuse donc les schémas non HTTP(S), les adresses privées/loopback et
 *    les redirections vers ces mêmes cibles, et on plafonne taille et durée.
 * 2. **Robustesse** — une image cassée ne doit pas faire échouer l'archive :
 *    elle est marquée « indisponible » dans le manifeste et les autres fichiers
 *    sont quand même téléchargés.
 */

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { IMAGE_EXPORT_LIMITS } from '@/lib/product-images-limits';

export { IMAGE_EXPORT_LIMITS };

/** Rôle d'une image dans la fiche produit. */
export type ProductImageRole = 'principale' | 'galerie' | 'variante';

/** Ligne produit minimale nécessaire à l'export. */
export interface ProductImageRow {
  id: string;
  name: string;
  image: string | null;
  images: unknown;
  variants: unknown;
}

/** Emplacement d'image détecté sur une fiche produit (sources dédoublonnées). */
export interface ProductImageSlot {
  source: string;
  role: ProductImageRole;
  variantName?: string;
}

export interface FetchedImage {
  bytes: Uint8Array;
  mime: string;
  extension: string;
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/pjpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/tiff': 'tiff',
};

/** Source considérée comme une URL distante ? */
function isRemoteSource(source: string): boolean {
  return /^https?:\/\//i.test(source);
}

/**
 * Une data URI complète est stockée en base : on la borne avant décodage pour
 * éviter qu'une valeur aberrante ne consomme toute la mémoire du processus.
 */
const MAX_DATA_URI_TEXT_LENGTH = Math.ceil((IMAGE_EXPORT_LIMITS.maxImageBytes * 4) / 3) + 1024;

/** Décode une data URI `data:image/…;base64,…`. */
export function decodeImageDataUri(source: string): FetchedImage | null {
  if (source.length > MAX_DATA_URI_TEXT_LENGTH) return null;
  const match = /^data:(image\/[a-z0-9.+-]+)((?:;[^,]*)?),([\s\S]*)$/i.exec(source);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const params = match[2] || '';
  const payload = match[3] || '';

  let bytes: Uint8Array;
  try {
    if (/;\s*base64/i.test(params)) {
      if (payload.length > MAX_DATA_URI_TEXT_LENGTH) return null;
      bytes = new Uint8Array(Buffer.from(payload, 'base64'));
    } else {
      // Rare : data URI encodée en pourcentage (`data:image/svg+xml,%3Csvg…`).
      const decoded = decodeURIComponent(payload);
      bytes = new TextEncoder().encode(decoded);
    }
  } catch {
    return null;
  }

  if (bytes.length === 0 || bytes.length > IMAGE_EXPORT_LIMITS.maxImageBytes) return null;
  const extension = EXTENSION_BY_MIME[mime] || 'img';
  return { bytes, mime, extension };
}

/** Devine le type d'une image à partir de ses premiers octets. */
export function sniffImageMime(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  const byte = (index: number) => bytes[index];

  if (byte(0) === 0xff && byte(1) === 0xd8 && byte(2) === 0xff) return 'image/jpeg';
  if (
    byte(0) === 0x89 &&
    byte(1) === 0x50 &&
    byte(2) === 0x4e &&
    byte(3) === 0x47 &&
    byte(4) === 0x0d &&
    byte(5) === 0x0a &&
    byte(6) === 0x1a &&
    byte(7) === 0x0a
  ) {
    return 'image/png';
  }
  if (byte(0) === 0x47 && byte(1) === 0x49 && byte(2) === 0x46 && byte(3) === 0x38) {
    return 'image/gif';
  }
  if (
    byte(0) === 0x52 &&
    byte(1) === 0x49 &&
    byte(2) === 0x46 &&
    byte(3) === 0x46 &&
    byte(8) === 0x57 &&
    byte(9) === 0x45 &&
    byte(10) === 0x42 &&
    byte(11) === 0x50
  ) {
    return 'image/webp';
  }
  if (byte(0) === 0x42 && byte(1) === 0x4d) return 'image/bmp';
  // AVIF / HEIF : boîte ISO « ftyp » avec la marque avif/heic à l'offset 8.
  if (byte(4) === 0x66 && byte(5) === 0x74 && byte(6) === 0x79 && byte(7) === 0x70) {
    const brand = String.fromCharCode(byte(8), byte(9), byte(10), byte(11)).toLowerCase();
    if (brand.startsWith('avi')) return 'image/avif';
    if (brand.startsWith('hei') || brand.startsWith('mif')) return 'image/heic';
  }
  return null;
}

/**
 * Type MIME retenu pour l'image : le type déclaré s'il est connu, sinon le
 * type deviné (certains hébergeurs répondent `application/octet-stream`), sinon
 * un sous-type `image/*` explicite.
 */
function resolveImageMime(
  declared: string | null,
  bytes: Uint8Array,
): { mime: string; extension: string } | null {
  const cleaned = (declared || '').split(';')[0].trim().toLowerCase();
  if (cleaned && EXTENSION_BY_MIME[cleaned]) {
    return { mime: cleaned, extension: EXTENSION_BY_MIME[cleaned] };
  }
  const sniffed = sniffImageMime(bytes);
  if (sniffed) {
    return { mime: sniffed, extension: EXTENSION_BY_MIME[sniffed] || 'img' };
  }
  if (cleaned.startsWith('image/')) {
    const extension = cleaned
      .slice('image/'.length)
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    return { mime: cleaned, extension: extension || 'img' };
  }
  return null;
}

/* ── Protection SSRF ──────────────────────────────────────────────────── */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

const BLOCKED_IPV4 =
  /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.0\.0\.|198\.18\.|198\.19\.)/;

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return BLOCKED_IPV4.test(address);
  if (version === 6) {
    const value = address.toLowerCase();
    if (value === '::' || value === '::1') return true;
    if (value.startsWith('fc') || value.startsWith('fd')) return true; // unique local
    if (/^fe[89ab]/.test(value)) return true; // link-local
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }
  // Chaîne qui n'est pas une IP littérale : traitée plus haut via DNS.
  return true;
}

/**
 * Valide une URL distante avant toute requête : schéma HTTP(S), hôte public
 * (littéral ou résolu), pas d'identifiants embarqués.
 */
export async function assertPublicImageUrl(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!hostname) return null;
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    return null;
  }

  if (isIP(hostname)) {
    return isPrivateAddress(hostname) ? null : url;
  }

  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.length === 0) return null;
    if (records.some((record) => isPrivateAddress(record.address))) return null;
  } catch {
    return null;
  }
  return url;
}

/** Lit un corps de réponse en refusant de dépasser `max` octets. */
async function readBodyWithLimit(response: Response, max: number): Promise<Uint8Array | null> {
  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    return buffer.length > 0 && buffer.length <= max ? buffer : null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > max) {
        await reader.cancel().catch(() => undefined);
        return null;
      }
      chunks.push(value);
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    return null;
  }
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}

const REQUEST_HEADERS = {
  accept: 'image/*,*/*;q=0.8',
  // Certains hébergeurs refusent les clients sans User-Agent identifiable.
  'user-agent': 'PosMarket-Images-Export/1.0',
};

/** Télécharge une image distante en suivant au plus 3 redirections validées. */
async function fetchRemoteImage(
  url: URL,
  signal: AbortSignal,
  hops = 0,
): Promise<FetchedImage | null> {
  const response = await fetch(url, {
    redirect: 'manual',
    signal,
    cache: 'no-store',
    headers: REQUEST_HEADERS,
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    await response.body?.cancel().catch(() => undefined);
    if (!location || hops >= 3) return null;
    let nextRaw: string;
    try {
      nextRaw = new URL(location, url).toString();
    } catch {
      return null;
    }
    const next = await assertPublicImageUrl(nextRaw);
    if (!next) return null;
    return fetchRemoteImage(next, signal, hops + 1);
  }

  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }

  const declaredLength = Number(response.headers.get('content-length') || '0');
  if (Number.isFinite(declaredLength) && declaredLength > IMAGE_EXPORT_LIMITS.maxImageBytes) {
    await response.body?.cancel().catch(() => undefined);
    return null;
  }

  const declaredType = response.headers.get('content-type');
  const cleanedType = (declaredType || '').split(';')[0].trim().toLowerCase();
  if (
    cleanedType &&
    !cleanedType.startsWith('image/') &&
    cleanedType !== 'application/octet-stream' &&
    cleanedType !== 'binary/octet-stream'
  ) {
    // Une page HTML ou du JSON ne sont pas des images : refus immédiat.
    await response.body?.cancel().catch(() => undefined);
    return null;
  }

  const bytes = await readBodyWithLimit(response, IMAGE_EXPORT_LIMITS.maxImageBytes);
  if (!bytes || bytes.length === 0) return null;
  const resolved = resolveImageMime(declaredType, bytes);
  if (!resolved) return null;
  return { bytes, mime: resolved.mime, extension: resolved.extension };
}

/** Signaux combinés : annulation du client + délai maximal par image. */
function imageSignal(clientSignal: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(IMAGE_EXPORT_LIMITS.timeoutMs);
  const anySignal = (AbortSignal as typeof AbortSignal & {
    any?: (signals: AbortSignal[]) => AbortSignal;
  }).any;
  return typeof anySignal === 'function' ? anySignal([clientSignal, timeout]) : timeout;
}

/**
 * Récupère les octets d'une source d'image (data URI ou URL distante).
 * Renvoie `null` pour toute source invalide, inaccessible ou non-image.
 */
export async function fetchProductImage(
  source: string,
  options: { signal?: AbortSignal } = {},
): Promise<FetchedImage | null> {
  const value = source.trim();
  if (!value) return null;

  if (value.startsWith('data:')) {
    return decodeImageDataUri(value);
  }

  if (!isRemoteSource(value)) return null;

  const url = await assertPublicImageUrl(value);
  if (!url) return null;

  const controller = new AbortController();
  const clientSignal = options.signal;
  const onAbort = () => controller.abort();
  clientSignal?.addEventListener('abort', onAbort, { once: true });
  const signal = imageSignal(controller.signal);

  try {
    return await fetchRemoteImage(url, signal);
  } catch {
    return null;
  } finally {
    clientSignal?.removeEventListener('abort', onAbort);
  }
}

/* ── Extraction des sources depuis une ligne produit ──────────────────── */

function cleanSource(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const source = value.trim();
  if (!source || source === 'null') return null;
  if (source.length > MAX_DATA_URI_TEXT_LENGTH && source.startsWith('data:')) return null;
  if (source.length > 2_048 && !source.startsWith('data:')) return null;
  return source;
}

/**
 * Liste ordonnée des images d'un produit : principale, galerie, puis images
 * de variantes. Les doublons (l'image principale est très souvent reprise en
 * tête de galerie) sont écartés : un seul fichier sera créé.
 */
export function collectProductImageSlots(row: ProductImageRow): ProductImageSlot[] {
  const slots: ProductImageSlot[] = [];
  const seen = new Set<string>();

  const push = (source: string | null, role: ProductImageRole, variantName?: string) => {
    if (!source || seen.has(source)) return;
    seen.add(source);
    slots.push({ source, role, ...(variantName ? { variantName } : {}) });
  };

  push(cleanSource(row.image), 'principale');

  const gallery = Array.isArray(row.images) ? row.images : [];
  for (const item of gallery) push(cleanSource(item), 'galerie');

  const variants = Array.isArray(row.variants) ? row.variants : [];
  for (const item of variants) {
    if (!item || typeof item !== 'object') continue;
    const variant = item as Record<string, unknown>;
    const name =
      typeof variant.name === 'string' ? variant.name.trim().slice(0, 80) : '';
    push(cleanSource(variant.image), 'variante', name || undefined);
  }

  return slots;
}

/* ── Nommage / manifeste ──────────────────────────────────────────────── */

/** Slug ASCII sûr pour un nom de dossier ou de fichier. */
export function slugifyFilePart(value: string, maxLength = 40): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength)
    .replace(/-+$/g, '');
  return slug || 'sans-nom';
}

/** `2026-10-24` (date locale du serveur, suffisante pour classer les exports). */
export function exportDateStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/* ── Arborescence de l'archive ────────────────────────────────────────── */

/** Décrit la position d'une image dans l'archive (dossier = produit ou racine). */
export interface ArchiveImageTarget {
  /** Produit concerné (pour les libellés). */
  productName: string;
  /** Position 1-based du produit dans le catalogue. */
  productIndex: number;
  /** Nombre total d'images du produit (décide dossier ou fichier direct). */
  productImageCount: number;
}

/** `001-nom-du-produit` : le préfixe conserve l'ordre du catalogue. */
export function productArchiveBaseName(target: ArchiveImageTarget): string {
  return `${String(target.productIndex).padStart(3, '0')}-${slugifyFilePart(target.productName, 40)}`;
}

/** Suffixe lisible du fichier : `01-principale`, `02-galerie`, `03-variante-rouge`. */
export function imageFilePrefix(slot: ProductImageSlot, index: number): string {
  const suffix =
    slot.role === 'variante'
      ? slugifyFilePart(`variante-${slot.variantName || ''}`, 30)
      : slot.role;
  return `${String(index + 1).padStart(2, '0')}-${suffix}`;
}

/**
 * Chemin d'une image dans l'archive.
 *
 * Toutes les photos vivent dans **un seul dossier** (la racine de l'archive) :
 * un produit qui n'a qu'une photo donne directement `001-nom-du-produit.jpg`.
 * Seuls les produits qui ont **plusieurs** photos reçoivent un sous-dossier
 * (`001-nom-du-produit/01-principale.jpg`, `02-galerie.jpg`…) pour garder
 * leurs images ensemble.
 */
export function buildImageArchivePath(
  archiveName: string,
  target: ArchiveImageTarget,
  slot: ProductImageSlot,
  slotIndex: number,
  extension: string,
): string {
  const base = productArchiveBaseName(target);
  if (target.productImageCount <= 1) {
    return `${archiveName}/${base}.${extension}`;
  }
  return `${archiveName}/${base}/${imageFilePrefix(slot, slotIndex)}.${extension}`;
}

/** Nom du dossier racine de l'archive et du fichier `.zip`. */
export function buildImagesArchiveName(storeName: string, date = new Date()): string {
  return `images-produits-${slugifyFilePart(storeName, 40)}-${exportDateStamp(date)}`;
}

export interface ImagesManifestRow {
  productId: string;
  productName: string;
  role: ProductImageRole;
  variantName?: string;
  file: string;
  source: string;
  status: 'ok' | 'indisponible' | 'limite-atteinte' | 'taille-depassee';
  bytes?: number;
}

function csvCell(value: unknown, delimiter = ';'): string {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (text.includes(delimiter) || text.includes('"') || /[\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** Source affichable dans le manifeste (les data URI sont tronquées). */
export function manifestSourceLabel(source: string): string {
  if (source.startsWith('data:')) {
    const header = source.slice(0, source.indexOf(',') + 1);
    return `${header}…`;
  }
  return source.length > 500 ? `${source.slice(0, 497)}…` : source;
}

/** Manifeste CSV (séparateur `;`, BOM UTF-8 pour Excel). */
export function buildImagesManifestCsv(
  rows: ImagesManifestRow[],
  storeName: string,
): string {
  const header = [
    'Boutique',
    'Produit',
    'ID produit',
    'Type',
    'Variante',
    'Fichier',
    'Source',
    'Statut',
    'Taille (octets)',
  ];
  const lines = [header.join(';')];
  for (const row of rows) {
    lines.push(
      [
        csvCell(storeName),
        csvCell(row.productName),
        csvCell(row.productId),
        csvCell(row.role),
        csvCell(row.variantName || ''),
        csvCell(row.file),
        csvCell(manifestSourceLabel(row.source)),
        csvCell(row.status),
        csvCell(row.bytes ?? ''),
      ].join(';'),
    );
  }
  return `\ufeff${lines.join('\r\n')}\r\n`;
}

/** Note explicative déposée à la racine de chaque archive. */
export function buildImagesReadme(
  storeName: string,
  totals: { products: number; files: number; failures: number },
): string {
  return [
    `Images produits — ${storeName}`,
    `Export du ${new Date().toLocaleString('fr-FR')}`,
    '',
    `${totals.files} image(s) pour ${totals.products} produit(s) avec photo.`,
    totals.failures > 0
      ? `${totals.failures} image(s) n'ont pas pu être récupérées : voir le manifeste.`
      : 'Toutes les images ont été récupérées.',
    '',
    'Toutes les photos sont rangées dans ce même dossier, dans l’ordre du',
    'catalogue. Un produit qui n’a qu’une photo donne directement un fichier',
    '« 001-nom-du-produit.jpg » ; un produit qui a plusieurs photos reçoit un',
    'sous-dossier à son nom (image principale, galerie, variantes).',
    '',
    'Le fichier « manifeste-images.csv » associe chaque fichier à son produit',
    'et à son rôle (principale, galerie ou variante).',
    '',
    'Archive générée automatiquement par PosMarket.',
  ].join('\r\n');
}
