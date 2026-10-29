import { NextResponse } from 'next/server';
import { rateLimit, rateLimitMessage } from './rate-limit';
import { rateLimitShared } from './rate-limit-db';

/**
 * Limitation de débit des API.
 *
 * Le but n'est pas d'empêcher un usage normal, mais de rendre rentables
 * les abus : bourrage d'identifiants, spam d'avis, envoi massif de liens
 * magiques, tentative de giveaway sur le checkout, saturation d'une boutique.
 *
 * Chaque famille d'API a sa propre politique : une lecture de catalogue
 * peut être généreuse, une connexion ou un encaissement doit être strict.
 */

export type RateLimitPolicy =
  /** Lecture simple (fiche produit, avis d'une boutique, listes…). */
  | 'read'
  /** Recherche full-text : plus coûteuse (trigram + FTS). */
  | 'search'
  /** Écriture métier (mise à jour de fiche, statut, fiche produit…). */
  | 'write'
  /** Authentification : lien magique, connexion. */
  | 'auth'
  /** Action sensible : checkout, encaissement POS, administration. */
  | 'sensitive';

interface Policy {
  /** Nombre d'appels autorisés par fenêtre. */
  limit: number;
  /** Durée de la fenêtre (ms). */
  windowMs: number;
}

const POLICIES: Record<RateLimitPolicy, Policy> = {
  read: { limit: 240, windowMs: 60_000 },
  search: { limit: 90, windowMs: 60_000 },
  write: { limit: 60, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 15 * 60_000 },
  sensitive: { limit: 20, windowMs: 60_000 },
};

/** Familles de routes exclues : appelées par des tiers, pas par l'IHM. */
const EXCLUDED_PATHS = [
  '/api/auth/',
  '/api/ping',
  '/api/marketplace/catalog',
  '/api/marketplace/home',
];

/** Webhooks de paiement / messagerie : filtrés par signature, pas par IP. */
const WEBHOOK_PATHS = [
  '/api/kkiapay/webhook',
  '/api/feexpay/webhook',
  '/api/fedapay/webhook',
  '/api/saspay/webhook',
  '/api/whatsapp/webhook',
];

/**
 * Détermine la politique d'une route.
 * Le chemin sert aussi de groupe de compteur : deux endpoints d'une même
 * famille partagent un compteur, deux familles distinctes non.
 */
export function policyForPath(pathname: string, method: string): RateLimitPolicy | null {
  if (WEBHOOK_PATHS.some((path) => pathname.startsWith(path))) return null;
  if (EXCLUDED_PATHS.some((path) => pathname.startsWith(path))) return null;

  // Administration PAM : strictement limitée.
  if (pathname.startsWith('/api/pam')) return 'sensitive';

  if (
    pathname.startsWith('/api/marketplace/auth/login') ||
    pathname.startsWith('/api/marketplace/seller/auth/login')
  ) {
    return 'auth';
  }

  if (
    pathname.startsWith('/api/marketplace/checkout') ||
    pathname.startsWith('/api/marketplace/seller/pos/checkout')
  ) {
    return 'sensitive';
  }

  if (pathname.startsWith('/api/marketplace/search')) return 'search';

  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}

/**
 * IP du client, lue directement sur la requête.
 *
 * Le proxy s'exécute avant le rendu : `headers()` de `next/headers` n'y est pas
 * disponible, il faut donc lire l'en-tête de la requête. Sans cela, toutes les
 * requêtes partageraient la même clé de compteur.
 */
export function clientIpFromRequest(request: Request): string {
  const headers = request.headers;
  const forwarded = headers.get('x-forwarded-for') || '';
  const first = forwarded.split(',')[0]?.trim();
  return (
    first ||
    headers.get('x-real-ip') ||
    headers.get('x-vercel-forwarded-for') ||
    'inconnu'
  );
}

/**
 * Applique la politique de la route. Renvoie une réponse 429 si l'appelant
 * a dépassé son quota, `null` si l'appel est autorisé.
 */
export async function enforceApiRateLimit(
  request: Request & { nextUrl?: URL },
): Promise<NextResponse | null> {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();
  const policy = policyForPath(url.pathname, method);
  if (!policy) return null;

  const { limit, windowMs } = POLICIES[policy];
  const ip = clientIpFromRequest(request);

  // Groupe de compteur : la famille d'API (3 premiers segments).
  const group = url.pathname.split('/').filter(Boolean).slice(0, 3).join('/');
  const result = rateLimit(`api:${policy}:${group}:${ip}`, limit, windowMs);

  if (result.ok) return null;

  return NextResponse.json(
    {
      error: rateLimitMessage(result.retryAfterSeconds),
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'Cache-Control': 'no-store',
      },
    },
  );
}

/** Politique appliquée à une route (utile pour la documentation). */
export function policyLimits(policy: RateLimitPolicy) {
  return POLICIES[policy];
}

/**
 * Quota strict partagé (compteur en base).
 *
 * Réservé aux actions où contourner le quota coûte cher : connexion,
 * encaissement, administration. Le compteur survit au redéploiement et est
 * partagé par toutes les instances.
 */
export async function enforceSharedRateLimit(
  request: Request & { nextUrl?: URL },
  policy: RateLimitPolicy,
): Promise<NextResponse | null> {
  const url = new URL(request.url);
  const { limit, windowMs } = POLICIES[policy];
  const ip = clientIpFromRequest(request);
  const group = url.pathname.split('/').filter(Boolean).slice(0, 3).join('/');
  const result = await rateLimitShared(
    `api:${policy}:${group}:${ip}`,
    limit,
    windowMs,
  );

  if (result.ok) return null;

  return NextResponse.json(
    {
      error: rateLimitMessage(result.retryAfterSeconds),
      retryAfterSeconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSeconds),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'Cache-Control': 'no-store',
      },
    },
  );
}
