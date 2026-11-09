import 'server-only';

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { profiles } from '@/db/schema';

/**
 * Lecture du profil en cache de données (tags: profile:<userId>, TTL 300s).
 * Réduit drastiquement les allers-retours vers Neon lors de la navigation
 * sur le dashboard / POS / inventaire.
 */
const getCachedProfile = (userId: string) =>
  unstable_cache(
    async () => {
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      return profile ?? null;
    },
    ['user-profile', userId],
    {
      tags: [`profile:${userId}`],
      revalidate: 300,
    }
  )();

/**
 * Lecture du profil mémoïsée par requête et adossée au cache Next.js.
 */
export const getProfileById = cache(async (userId: string) => {
  if (!userId) return null;
  return getCachedProfile(userId);
});
