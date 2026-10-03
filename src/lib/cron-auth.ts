import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

/**
 * Vérification des requêtes de tâches planifiées (Vercel Cron).
 *
 * Le secret doit être présent : une variable d'environnement absente ne doit
 * JAMAIS ouvrir l'endpoint, sinon le travail planifié (envoi d'emails et de
 * WhatsApp, activation d'abonnements) devient déclenchable par n'importe quel
 * visiteur. On compare en temps constant pour ne pas révéler le secret par
 * mesure du temps de réponse.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;

  const authHeader = request.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const querySecret = request.nextUrl.searchParams.get('secret') || '';

  const expected = Buffer.from(secret);
  for (const candidate of [bearer, querySecret]) {
    const provided = Buffer.from(candidate);
    if (provided.length !== expected.length) continue;
    if (timingSafeEqual(provided, expected)) return true;
  }
  return false;
}