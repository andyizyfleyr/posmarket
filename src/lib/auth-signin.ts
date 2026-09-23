import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles, accounts } from '@/db/schema';
import { getAdminPhones, getAdminEmails, notify } from '@/lib/notifications';

export const AUTH_INTENT_COOKIE = 'auth_intent';

export interface AuthIntent {
  intent: 'buyer' | 'seller';
  name?: string;
}

export type SerializedSessionUser = {
  id: string;
  email: string;
  user_metadata: { full_name?: string | null; account_type?: string | null };
  accountType: string;
  isSuperAdmin: boolean;
};

export function serializeProfile(profile: typeof profiles.$inferSelect): SerializedSessionUser {
  const accountType = profile.accountType || 'buyer';
  return {
    id: profile.id,
    email: profile.email,
    user_metadata: { full_name: profile.fullName, account_type: accountType },
    accountType,
    isSuperAdmin: profile.isSuperAdmin,
  };
}

export async function setAuthIntentCookie(intent: AuthIntent): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(AUTH_INTENT_COOKIE, JSON.stringify(intent), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 10,
  });
}

export async function readAuthIntent(): Promise<AuthIntent | null> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(AUTH_INTENT_COOKIE)?.value;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthIntent;
    return parsed && (parsed.intent === 'seller' || parsed.intent === 'buyer') ? parsed : null;
  } catch {
    return null;
  }
}

async function notifyNewSeller(profile: { fullName: string | null; email: string }): Promise<void> {
  const name = profile.fullName || profile.email.split('@')[0];
  try {
    const adminPhones = await getAdminPhones();
    for (const adminPhone of adminPhones) {
      await notify({
        userId: null,
        phone: adminPhone,
        eventType: 'NOUVELLE_INSCRIPTION',
        title: 'Nouvelle inscription',
        body: `Nouveau commerçant inscrit sur PosMarket : ${name} (${profile.email}).`,
        templateParams: [name, profile.email],
        emailData: { name, email: profile.email },
      });
    }
    const adminEmails = await getAdminEmails();
    for (const adminEmail of adminEmails) {
      await notify({
        userId: null,
        email: adminEmail,
        eventType: 'NOUVELLE_INSCRIPTION',
        title: 'Nouvelle inscription',
        body: `Nouveau commerçant inscrit sur PosMarket : ${name} (${profile.email}).`,
        templateParams: [name, profile.email],
        emailData: { name, email: profile.email },
      });
    }
  } catch {
    // Ne jamais bloquer la connexion si la notification admin échoue.
  }
}

/**
 * Retrouve le profil par email, le crée si besoin (type selon l'intention
 * buyer/seller capturée à la demande), et horodate emailVerified à la
 * validation du lien (ou au passage OAuth).
 */
export async function ensureAuthProfile(opts: {
  email?: string | null;
  name?: string | null;
  markVerified?: boolean;
}): Promise<(typeof profiles.$inferSelect) | null> {
  const email = String(opts.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return null;

  const intent = await readAuthIntent();
  let [profile] = await db.select().from(profiles).where(eq(profiles.email, email)).limit(1);

  if (profile) {
    if (opts.markVerified && !profile.emailVerified) {
      [profile] = await db
        .update(profiles)
        .set({ emailVerified: new Date() })
        .where(eq(profiles.id, profile.id))
        .returning();
    }
    return profile;
  }

  const requestedName = opts.name?.trim() || intent?.name?.trim() || '';
  const accountType = intent?.intent === 'seller' ? 'seller' : 'buyer';

  const [created] = await db
    .insert(profiles)
    .values({
      email,
      fullName: requestedName || email.split('@')[0],
      accountType,
      emailVerified: opts.markVerified ? new Date() : null,
    })
    .returning();

  if (accountType === 'seller') {
    await notifyNewSeller(created);
  }
  return created;
}

/** Traduit les codes d'erreur OAuth Google d'Auth.js en messages français. */
export function googleErrorToMessage(code?: string): string {
  switch (code) {
    case 'OAuthAccountNotLinked':
      return 'Un compte PosMarket existe déjà avec cet email. Connectez-vous d’abord avec le lien envoyé par email, puis reliez votre compte Google depuis votre profil.';
    case 'OAuthSignin':
    case 'OAuthCallback':
    case 'OAuthCreateAccount':
    case 'CallbackRouteError':
      return 'Google n’a pas pu valider la connexion. Réessayez ou utilisez le lien email.';
    case 'AccessDenied':
      return 'Accès refusé par Google.';
    case 'Configuration':
      return 'La connexion Google n’est pas configurée correctement. Contactez le support.';
    default:
      return 'Impossible de se connecter avec Google pour le moment.';
  }
}

/** Enregistre le lien Google (providerAccountId) sur un profil existant. */
export async function linkGoogleAccount(opts: {
  userId: string;
  providerAccountId: string;
}): Promise<void> {
  if (!opts.providerAccountId) return;
  await db
    .insert(accounts)
    .values({
      userId: opts.userId,
      type: 'oauth',
      provider: 'google',
      providerAccountId: String(opts.providerAccountId),
    })
    .onConflictDoNothing({ target: [accounts.provider, accounts.providerAccountId] });
}