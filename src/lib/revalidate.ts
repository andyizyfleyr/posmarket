import { revalidateTag, updateTag } from 'next/cache';

/**
 * Invalide un tag de cache, quel que soit le contexte d'appel.
 *
 * `updateTag` — le bon outil pour le web (read-your-own-writes d'un Server
 * Action) — **lève une erreur** dès qu'il est appelé ailleurs : « updateTag
 * can only be called from within a Server Action ». Or les routes API de
 * l'application mobile appellent les mêmes actions serveur directement
 * (hors contexte Server Action), ce qui faisait échouer toutes les
 * soumissions (vendeur comme acheteur).
 *
 * Ici : `updateTag` en Server Action, sinon repli sur `revalidateTag` avec
 * `{ expire: 0 }` (expiration immédiate, sémantique identique) — autorisé
 * dans les Route Handlers.
 */
export function refreshTag(tag: string): void {
  try {
    updateTag(tag);
    return;
  } catch {
    // Hors contexte Server Action (route API mobile) : repli ci-dessous.
  }
  try {
    revalidateTag(tag, { expire: 0 });
  } catch {
    // Contexte sans cache (build, script) : rien à invalider.
  }
}
