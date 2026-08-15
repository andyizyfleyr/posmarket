'use server';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';

function serializeUser(profile: any) {
  return {
    id: profile.id,
    email: profile.email,
    user_metadata: { full_name: profile.fullName },
  };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('userId')?.value;
  if (!userId) return { user: null };

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) return { user: null };

  return { user: serializeUser(profile) };
}

export async function signInWithPasswordSession(email: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (!profile) return { user: null, error: { message: 'Invalid login credentials' } };

  (await cookies()).set('userId', profile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
  return { user: serializeUser(profile), error: null };
}

export async function signUpSession(name: string, email: string) {
  const [existing] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);
  if (existing) {
    (await cookies()).set('userId', existing.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    return { user: serializeUser(existing), error: null };
  }

  const [profile] = await db
    .insert(profiles)
    .values({
      email,
      fullName: name,
      subscriptionTier: 'PRO',
      subscriptionStatus: 'ACTIVE',
    })
    .returning();

  (await cookies()).set('userId', profile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
  return { user: serializeUser(profile), error: null };
}

export async function signOutSession() {
  (await cookies()).delete('userId');
  return { error: null };
}

export async function setSessionUser(userId: string | null) {
  const cookieStore = await cookies();
  if (!userId) {
    cookieStore.delete('userId');
  } else {
    cookieStore.set('userId', userId, { path: '/', maxAge: 60 * 60 * 24 * 7 });
  }
  return { session: userId ? { user: { id: userId } } : null, error: null };
}
