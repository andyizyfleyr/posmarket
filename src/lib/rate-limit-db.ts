import { and, eq, gt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { apiRateLimits } from '@/db/schema';
import { rateLimit, type RateLimitResult } from './rate-limit';

/**
 * Limitation de débit partagée (base Neon).
 *
 * Utilisée pour les quotas stricts — connexion, encaissement, administration —
 * là où le limiteur en mémoire ne suffit pas : sur Vercel, chaque instance a
 * sa propre mémoire, donc un attaquant peut répartir ses requêtes sur
 * plusieurs instances et contourner le quota.
 *
 * Si la table n'est pas encore migrée (ou si la base est injoignable), on
 * retombe automatiquement sur le limiteur en mémoire : le service reste
 * utilisable, seule la garantie « partagée » est perdue.
 */

export async function rateLimitShared(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = new Date();
  try {
    // Purge opportuniste : une ligne par couple (politique, groupe, IP) est
    // créée puis jamais supprimée. Sans entretien, la table croît avec le
    // nombre d'adresses vues. `purgeExpiredRateLimits` n'était appelée nulle
    // part ; on déclenche donc la purge ici, au plus une fois par heure et par
    // instance (variable de module, pas de stockage partagé nécessaire).
    void maybePurge(now);

    // Incrémente le compteur et récupère la ligne courante en une requête.
    const rows = await db
      .update(apiRateLimits)
      .set({
        count: sql`${apiRateLimits.count} + 1`,
        updatedAt: now,
      })
      .where(
        and(eq(apiRateLimits.key, key), gt(apiRateLimits.resetAt, now)),
      )
      .returning({ count: apiRateLimits.count, resetAt: apiRateLimits.resetAt });

    if (rows.length > 0) {
      const bucket = rows[0];
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((bucket.resetAt.getTime() - now.getTime()) / 1000),
      );
      if (bucket.count > limit) {
        return { ok: false, remaining: 0, retryAfterSeconds };
      }
      return { ok: true, remaining: limit - bucket.count, retryAfterSeconds };
    }

    // Fenêtre expirée ou première requête : on (re)crée la fenêtre.
    await db
      .insert(apiRateLimits)
      .values({
        key,
        count: 1,
        resetAt: new Date(now.getTime() + windowMs),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: apiRateLimits.key,
        set: {
          count: 1,
          resetAt: new Date(now.getTime() + windowMs),
          updatedAt: now,
        },
      });

    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  } catch {
    // Table absente (migration non appliquée) ou base injoignable : on dégrade
    // proprement vers le limiteur en mémoire plutôt que de tout bloquer.
    return rateLimit(key, limit, windowMs);
  }
}

/** Dernière purge connue de cette instance (mémoire du processus). */
let lastPurgeAt = 0;
const PURGE_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Déclenche une purge au plus une fois par heure.
 *
 * Volontairement « fire and forget » : la purge ne doit jamais retarder ni faire
 * échouer une requête utilisateur. Elle est silencieuse en cas d'erreur (table
 * absente, base injoignable) — le limiteur en mémoire prend alors le relais.
 */
async function maybePurge(now: Date): Promise<void> {
  if (now.getTime() - lastPurgeAt < PURGE_INTERVAL_MS) return;
  lastPurgeAt = now.getTime();
  try {
    await purgeExpiredRateLimits();
  } catch {
    // ignore : entretien seulement
  }
}

/** Purge les fenêtres expirées (tâche de maintenance). */
export async function purgeExpiredRateLimits(): Promise<number> {
  try {
    const deleted = await db
      .delete(apiRateLimits)
      .where(sql`${apiRateLimits.resetAt} <= now()`)
      .returning({ key: apiRateLimits.key });
    return deleted.length;
  } catch {
    return 0;
  }
}
