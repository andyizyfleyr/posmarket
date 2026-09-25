import { encode } from 'next-auth/jwt';
import { db } from '@/db';
import { profiles, stores } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAdminSession } from '@/app/actions/admin-auth';

// Session de 10 ans pour la session Auth.js (identique à src/auth.ts)
const SESSION_MAX_AGE = 60 * 60 * 24 * 365 * 10;

export interface ImpersonationCookiePayload {
  active: boolean;
  adminId: string;
  adminUsername: string;
  adminDisplayName?: string;
  userId: string;
  userName: string;
  userEmail: string;
  accountType: string;
  isSuperAdmin: boolean;
  startedAt: number;
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('AUTH_SECRET is not defined in environment variables');
  }
  return secret;
}

export interface CreateImpersonationOptions {
  userId?: string | null;
  storeId?: string | null;
  email?: string | null;
  redirectTo?: string | null;
  isSecure?: boolean;
}

export interface ImpersonationResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
  cookies: Array<{
    name: string;
    value: string;
    options: {
      httpOnly: boolean;
      sameSite: 'lax' | 'strict' | 'none';
      secure: boolean;
      path: string;
      maxAge: number;
    };
  }>;
  cookiesToDelete?: string[];
  targetUser?: {
    id: string;
    email: string;
    fullName: string | null;
    accountType: string;
    isSuperAdmin: boolean;
  };
}

/**
 * Crée une session NextAuth valide pour n'importe quel compte utilisateur,
 * sécurisée par la vérification obligatoire des privilèges d'administrateur PAM.
 */
export async function createImpersonationSession(
  opts: CreateImpersonationOptions,
): Promise<ImpersonationResult> {
  // 1. Vérification stricte des droits admin PAM
  const admin = await getAdminSession();
  if (!admin) {
    return {
      success: false,
      error: 'Non autorisé. Vous devez être connecté en tant qu’administrateur PAM.',
      cookies: [],
    };
  }

  // 2. Résolution du profil utilisateur cible
  let targetUserId = opts.userId?.trim();

  // Si on a passé un storeId sans userId, on trouve le propriétaire de la boutique
  if (!targetUserId && opts.storeId) {
    const [store] = await db
      .select({ userId: stores.userId })
      .from(stores)
      .where(eq(stores.id, opts.storeId))
      .limit(1);
    if (store?.userId) {
      targetUserId = store.userId;
    }
  }

  let profile = null;
  if (targetUserId) {
    const [p] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, targetUserId))
      .limit(1);
    profile = p;
  } else if (opts.email) {
    const [p] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.email, opts.email.trim().toLowerCase()))
      .limit(1);
    profile = p;
  }

  if (!profile) {
    return {
      success: false,
      error: 'Compte utilisateur introuvable dans la base de données.',
      cookies: [],
    };
  }

  const secret = getAuthSecret();
  const accountType = profile.accountType || 'buyer';
  const isSuperAdmin = Boolean(profile.isSuperAdmin);

  // 3. Construction du token JWT NextAuth / Auth.js
  const jwtPayload = {
    id: profile.id,
    sub: profile.id,
    email: profile.email,
    name: profile.fullName ?? undefined,
    picture: profile.avatarUrl ?? undefined,
    accountType,
    isSuperAdmin,
  };

  const defaultSalt = 'authjs.session-token';
  const secureSalt = '__Secure-authjs.session-token';

  const defaultToken = await encode({
    token: jwtPayload,
    secret,
    salt: defaultSalt,
    maxAge: SESSION_MAX_AGE,
  });

  const secureToken = await encode({
    token: jwtPayload,
    secret,
    salt: secureSalt,
    maxAge: SESSION_MAX_AGE,
  });

  // 4. Payload d'information sur l'impersonation (pour affichage bannière)
  const impersonationPayload: ImpersonationCookiePayload = {
    active: true,
    adminId: admin.id,
    adminUsername: admin.username,
    adminDisplayName: admin.displayName,
    userId: profile.id,
    userName: profile.fullName || profile.email,
    userEmail: profile.email,
    accountType,
    isSuperAdmin,
    startedAt: Date.now(),
  };

  const isSecureEnv = opts.isSecure ?? (process.env.NODE_ENV === 'production');

  const cookiesToSet: ImpersonationResult['cookies'] = [
    // Cookie standard (fonctionne en dev HTTP et prod)
    {
      name: defaultSalt,
      value: defaultToken,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecureEnv,
        path: '/',
        maxAge: SESSION_MAX_AGE,
      },
    },
    // Cookie d'information pour la bannière UI d'impersonation (non-httpOnly pour lecture côté client)
    {
      name: 'pam_impersonation',
      value: encodeURIComponent(JSON.stringify(impersonationPayload)),
      options: {
        httpOnly: false,
        sameSite: 'lax',
        secure: isSecureEnv,
        path: '/',
        maxAge: 60 * 60 * 24, // 24 heures
      },
    },
  ];

  // Si environnement sécurisé (HTTPS), ajouter le cookie préfixé __Secure-
  if (isSecureEnv) {
    cookiesToSet.push({
      name: secureSalt,
      value: secureToken,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: SESSION_MAX_AGE,
      },
    });
  }

  // 5. Gestion de la boutique active (si le compte est vendeur et possède une boutique)
  let resolvedStoreId = opts.storeId || null;
  if (!resolvedStoreId && accountType === 'seller') {
    const [userStore] = await db
      .select({ id: stores.id })
      .from(stores)
      .where(eq(stores.userId, profile.id))
      .limit(1);
    if (userStore?.id) {
      resolvedStoreId = userStore.id;
    }
  }

  if (resolvedStoreId) {
    cookiesToSet.push({
      name: 'currentStoreId',
      value: resolvedStoreId,
      options: {
        httpOnly: false,
        sameSite: 'lax',
        secure: isSecureEnv,
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      },
    });
  }

  // 6. Détermination de l'URL de redirection
  let targetRedirectUrl: string;
  if (opts.redirectTo && opts.redirectTo.startsWith('/')) {
    targetRedirectUrl = opts.redirectTo;
  } else if (accountType === 'buyer' && !isSuperAdmin) {
    targetRedirectUrl = '/mon-compte';
  } else {
    targetRedirectUrl = '/dashboard';
  }

  return {
    success: true,
    redirectUrl: targetRedirectUrl,
    cookies: cookiesToSet,
    cookiesToDelete: ['auth_intent', 'auth_role_error'],
    targetUser: {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      accountType,
      isSuperAdmin,
    },
  };
}
