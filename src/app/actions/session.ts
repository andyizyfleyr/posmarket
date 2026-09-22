'use server';

import { createHmac } from 'crypto';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';

const BUYER_COOKIE = 'buyerUserId';
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 10;

function getSigningSecret(): string {
  return process.env.ADMIN_AUTH_SECRET || createHmac('sha256', 'pam-buyer').update(process.env.DATABASE_URL || '').digest('base64');
}

function signToken(userId: string): string {
  const hmac = createHmac('sha256', getSigningSecret()).update(userId).digest('hex');
  return `${userId}.${hmac}`;
}

function verifyToken(token: string): string | null {
  const idx = token.lastIndexOf('.');
  if (idx === -1) return null;
  const userId = token.slice(0, idx);
  const expected = createHmac('sha256', getSigningSecret()).update(userId).digest('hex');
  const actual = token.slice(idx + 1);
  if (expected.length !== actual.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0 ? userId : null;
}

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
  const token = cookieStore.get(BUYER_COOKIE)?.value;
  if (!token) return { user: null };

  const userId = verifyToken(token);
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
        error: "Cet email est associé à un compte commerçant (vendeur). Veuillez vous connecter sur le portail commerçant (/login).",
      };
    }
  } else {
    [profile] = await db.insert(profiles).values({
      email: cleanEmail,
      fullName: cleanEmail?.split('@')[0],
      accountType: 'buyer',
    }).returning();
  }

  (await cookies()).set(BUYER_COOKIE, signToken(profile.id), { path: '/', maxAge: SESSION_MAX_AGE });
  return { user: serializeUser(profile), error: null };
}

export async function signUpSession(name: string, email: string) {
  const cleanEmail = email?.trim().toLowerCase();
  const [existing] = await db.select().from(profiles).where(eq(profiles.email, cleanEmail)).limit(1);

  if (existing) {
    if (existing.accountType === 'seller' || existing.accountType === 'admin' || existing.isSuperAdmin) {
      return {
        user: null,
        error: "Cet email est déjà associé à un compte commerçant (vendeur). Veuillez vous connecter sur le portail commerçant (/login).",
      };
    }
    (await cookies()).set(BUYER_COOKIE, signToken(existing.id), { path: '/', maxAge: SESSION_MAX_AGE });
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

  (await cookies()).set(BUYER_COOKIE, signToken(profile.id), { path: '/', maxAge: SESSION_MAX_AGE });
  return { user: serializeUser(profile), error: null };
}

export async function signOutSession() {
  const cookieStore = await cookies();
  cookieStore.delete(BUYER_COOKIE);
  cookieStore.delete('userId');
  return { error: null };
}

export async function setSessionUser(userId: string | null) {
  const cookieStore = await cookies();
  if (!userId) {
    cookieStore.delete(BUYER_COOKIE);
  } else {
    cookieStore.set(BUYER_COOKIE, signToken(userId), { path: '/', maxAge: SESSION_MAX_AGE });
  }
  return { session: userId ? { user: { id: userId } } : null, error: null };
}
