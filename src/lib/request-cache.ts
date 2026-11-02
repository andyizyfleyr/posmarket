import 'server-only';

import { cache } from 'react';

import { getCurrentSession } from '@/app/actions/session';
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

/** Session de l'utilisateur courant, dédupliquée. */
export const getSessionUser = cache(async () => {
  const { user } = await getCurrentSession();
  return user;
});

/** Accès au compte (espace, profil, boutiques), dédupliqué. */
export const getAccountAccess = cache(async (userId: string): Promise<AccountAccess> => {
  return resolveAccountAccess(userId);
});
