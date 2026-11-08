import 'server-only';

import { cache } from 'react';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { profiles } from '@/db/schema';

/**
 * Lecture du profil mémoïsée par requête.
 *
 * Le callback `jwt` d'Auth.js relit le profil à chaque lecture de session pour
 * rafraîchir les claims, puis `resolveAccountAccess` le relisait une seconde
 * fois. `cache()` partage la même promesse : une seule requête `profiles` par
 * rendu (ou par server action), quel que soit le nombre d'appelants.
 *
 * Le cache ne survit pas à la requête : aucune donnée d'un utilisateur ne peut
 * être servie à un autre.
 */
export const getProfileById = cache(async (userId: string) => {
  if (!userId) return null;

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return profile ?? null;
});
