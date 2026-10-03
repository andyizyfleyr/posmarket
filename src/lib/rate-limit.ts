import { headers } from 'next/headers';

/**
 * Limitation de débit en mémoire.
 *
 * Couvre les abus les plus rentables pour un attaquant : bourrage
 * d'identifiants sur la connexion administrateur, envoi en boucle de liens
 * magiques, spam d'avis et de WhatsApp aux vendeurs.
 *
 * Portée : par instance. Sur Vercel chaque instance a sa propre mémoire, donc la
 * limite reste approximative sous charge et repart à zéro après un
 * redéploiement. Elle est efficace contre le script simple ; pour une garantie
 * stricte il faudrait un compteur partagé (table SQL ou Redis).
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let lastSweep = Date.now();

function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/** Enregistre un appel et indique s'il est autorisé. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds };
}

/** Adresse IP du client, derrière le proxy Vercel. */
export async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get('x-forwarded-for') || '';
    const first = forwarded.split(',')[0]?.trim();
    return first || h.get('x-real-ip') || h.get('x-vercel-forwarded-for') || 'inconnu';
  } catch {
    return 'inconnu';
  }
}

/** Message renvoyé à l'utilisateur quand la limite est atteinte. */
export function rateLimitMessage(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`;
  }
  return `Trop de tentatives. Réessayez dans ${seconds} seconde${seconds > 1 ? 's' : ''}.`;
}