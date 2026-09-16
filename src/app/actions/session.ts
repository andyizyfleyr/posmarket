'use server';

import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';

function serializeUser(profile: typeof profiles.$inferSelect) {
  return {
    id: profile.id,
    email: profile.email,
    user_metadata: { 
      full_name: profile.fullName,
      account_type: profile.accountType || 'buyer',
    },
    accountType: profile.accountType || 'buyer',
    isSuperAdmin: profile.isSuperAdmin,
  };
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const userId = cookieStore.get('buyerUserId')?.value;
  if (!userId) return { user: null };

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, userId)).limit(1);
  if (!profile) return { user: null };

  return { user: serializeUser(profile) };
}

export async function signInWithPasswordSession(email: string) {
  const cleanEmail = email?.trim().toLowerCase();
  let [profile] = await db.select().from(profiles).where(eq(profiles.email, cleanEmail)).limit(1);
  
  if (profile) {
    if (profile.accountType === 'seller' || profile.accountType === 'admin' || profile.isSuperAdmin) {
      return { 
        user: null, 
        error: "Cet email est associé à un compte commerçant (vendeur). Veuillez vous connecter sur le portail commerçant (/login)." 
      };
    }
  } else {
    [profile] = await db.insert(profiles).values({
      email: cleanEmail,
      fullName: cleanEmail.split('@')[0],
      accountType: 'buyer',
    }).returning();
  }

  (await cookies()).set('buyerUserId', profile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
  return { user: serializeUser(profile), error: null };
}

export async function signUpSession(name: string, email: string) {
  const cleanEmail = email?.trim().toLowerCase();
  const [existing] = await db.select().from(profiles).where(eq(profiles.email, cleanEmail)).limit(1);
  if (existing) {
    if (existing.accountType === 'seller' || existing.accountType === 'admin' || existing.isSuperAdmin) {
      return { 
        user: null, 
        error: "Cet email est déjà associé à un compte commerçant (vendeur). Veuillez vous connecter sur le portail commerçant (/login)." 
      };
    }
    (await cookies()).set('buyerUserId', existing.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
    return { user: serializeUser(existing), error: null };
  }

  const [profile] = await db
    .insert(profiles)
    .values({
      email: cleanEmail,
      fullName: name?.trim(),
      accountType: 'buyer',
    })
    .returning();

  (await cookies()).set('buyerUserId', profile.id, { path: '/', maxAge: 60 * 60 * 24 * 7 });
  return { user: serializeUser(profile), error: null };
}

export async function signOutSession() {
  (await cookies()).delete('buyerUserId');
  return { error: null };
}

export async function setSessionUser(userId: string | null) {
  const cookieStore = await cookies();
  if (!userId) {
    cookieStore.delete('buyerUserId');
  } else {
    cookieStore.set('buyerUserId', userId, { path: '/', maxAge: 60 * 60 * 24 * 7 });
  }
  return { session: userId ? { user: { id: userId } } : null, error: null };
}
