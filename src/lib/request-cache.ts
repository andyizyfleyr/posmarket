import 'server-only';

import { cache } from 'react';

import { auth } from '@/auth';
import { getMobileSessionUserId } from '@/lib/mobile-session';
import { serializeProfile } from '@/lib/auth-signin';
import { resolveAccountAccess, type AccountAccess } from '@/utils/account-access';

/**
 * Mémoïsation par requête.
 *
 * Sans cela, le même rendu paie deux fois les mêmes lectures : le layout
 * résolvait le compte via `resolveAccountAccess`, puis relisait `profiles`,
 * `stores` et `store_staff` par un second chemin. `cache()` conserve le
 * résultat pour la durée d'une requête HTTP ; deux appels dans le même rendu
 * donnent lieu à une seule lecture.
 *
 * Le cache est vidé à chaque requête : aucune donnée ne survit d'un
 * utilisateur à l'autre. Ce n'est donc PAS un cache applicatif (pas de
 * `unstable_cache`, pas de durée de vie) — c'est de la déduplication.
 */

/** Identifiant authentifié (Auth.js ou jeton Bearer mobile), dédupliqué. */
const getAuthUserId = cache(async (): Promise<string | null> => {
  let session = null;
  try {
    session = await auth();
  } catch {
    session = null;
  }
  let uid: string | null | undefined = session?.user?.id;
  if (!uid) uid = await getMobileSessionUserId();
  return uid ? String(uid) : null;
});

/** Accès au compte (espace, profil, boutiques), dédupliqué. */
export const getAccountAccess = cache(async (userId: string): Promise<AccountAccess> => {
  return resolveAccountAccess(userId);
});

/**
 * Session de l'utilisateur courant, dédupliquée.
 *
 * Dérivée de `getAccountAccess` : le profil n'est plus lu deux fois (une fois
 * ici, une fois dans la résolution d'accès). Les deux fonctions partagent donc
 * la même promesse et la même lecture `profiles`.
 */
export const getSessionUser = cache(async () => {
  const userId = await getAuthUserId();
  if (!userId) return null;
  const access = await getAccountAccess(userId);
  return access.profile ? serializeProfile(access.profile) : null;
});
