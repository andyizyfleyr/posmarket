'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { auth, signIn, signOut } from '@/auth';
import { serializeProfile, setAuthIntentCookie, googleErrorToMessage } from '@/lib/auth-signin';

export async function getCurrentSession() {
  let session = null;
  try {
    session = await auth();
  } catch {
    return { user: null };
  }
  const uid = session?.user?.id;
  if (!uid) return { user: null };

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, String(uid)))
    .limit(1)
    .catch(() => []);
  if (!profile) return { user: null };

  return { user: serializeProfile(profile) };
}

async function sendMagicLinkForBuyer(opts: { email?: string; name?: string }): Promise<{ user: null; error: string | null; sent?: boolean }> {
  const email = String(opts.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { user: null, error: 'Adresse email invalide.' };
  }
  await setAuthIntentCookie({ intent: 'buyer', name: opts.name?.trim() || undefined });
  try {
    const result = await signIn('email', { email, redirect: false, callbackUrl: '/' });
    if (result?.error) {
      return { user: null, error: String(result.error) };
    }
    return { user: null, error: null, sent: true };
  } catch (error) {
    return {
      user: null,
      error: error instanceof Error ? error.message : 'Erreur lors de l’envoi du lien de connexion.',
    };
  }
}

export async function signInWithPasswordSession(email: string) {
  return sendMagicLinkForBuyer({ email });
}

export async function signUpSession(name: string, email: string) {
  return sendMagicLinkForBuyer({ email, name });
}

export async function signOutSession() {
  try {
    await signOut({ redirect: false });
  } catch {
    // déjà déconnecté côté Auth.js
  }
  const cookieStore = await cookies();
  cookieStore.delete('userId');
  cookieStore.delete('buyerUserId');
  cookieStore.delete('auth_intent');
  return { error: null };
}

export async function googleBuyerSignInAction(callbackUrl?: string) {
  const target =
    typeof callbackUrl === 'string' && callbackUrl.startsWith('/')
      ? callbackUrl
      : '/';
  await setAuthIntentCookie({ intent: 'buyer' });
  const result = await signIn('google', { redirect: false, callbackUrl: target });
  if (!result?.url) {
    const code = (result as { code?: string } | null | undefined)?.code;
    return { error: googleErrorToMessage(code) };
  }
  // Navigation externe : emmène l'utilisateur vers l'écran Google.
  redirect(result.url);
}

export async function setSessionUser(_userId: string | null) {
  return { session: null, error: null };
}