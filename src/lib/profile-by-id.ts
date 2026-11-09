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

function hydrateProfileDates(profile: typeof profiles.$inferSelect | null) {
  if (!profile) return null;
  return {
    ...profile,
    createdAt: profile.createdAt
      ? profile.createdAt instanceof Date
        ? profile.createdAt
        : new Date(profile.createdAt)
      : profile.createdAt,
    subscriptionStartDate: profile.subscriptionStartDate
      ? profile.subscriptionStartDate instanceof Date
        ? profile.subscriptionStartDate
        : new Date(profile.subscriptionStartDate)
      : null,
    subscriptionEndDate: profile.subscriptionEndDate
      ? profile.subscriptionEndDate instanceof Date
        ? profile.subscriptionEndDate
        : new Date(profile.subscriptionEndDate)
      : null,
    emailVerified: profile.emailVerified
      ? profile.emailVerified instanceof Date
        ? profile.emailVerified
        : new Date(profile.emailVerified)
      : null,
  };
}

/**
 * Lecture du profil mémoïsée par requête et adossée au cache Next.js.
 */
export const getProfileById = cache(async (userId: string) => {
  if (!userId) return null;
  const profile = await getCachedProfile(userId);
  return hydrateProfileDates(profile);
});
