'use server';

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getClientIp, rateLimit, rateLimitMessage } from '@/lib/rate-limit';

const SESSION_COOKIE = 'pam_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 heures

/** 5 tentatives par quart d'heure et par IP : bloque le bourrage d'identifiants. */
const LOGIN_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const MIN_SECRET_LENGTH = 32;

/**
 * Secret de signature des cookies d'administration.
 *
 * Auparavant, en l'absence de `ADMIN_AUTH_SECRET`, la clé était dérivée de
 * `DATABASE_URL` : toute fuite de la chaîne de connexion (journal, sauvegarde,
 * variable exposée) permettait alors de FORGER un cookie admin valide, puisque
 * le mot de passe de la base devenait un secret partagé de signature.
 *
 * On refuse désormais de signer sans secret dédié suffisamment long. En
 * développement uniquement, un secret éphémère est généré : il invalide les
 * cookies à chaque redémarrage, ce qui est le comportement attendu en local.
 */
let ephemeralDevSecret: string | null = null;

function getSigningSecret(): string | null {
  const configured = (process.env.ADMIN_AUTH_SECRET || '').trim();
  if (configured.length >= MIN_SECRET_LENGTH) return configured;
  if (configured.length > 0) {
    console.error(
      `[auth] ADMIN_AUTH_SECRET trop court (${configured.length} caractères, minimum ${MIN_SECRET_LENGTH}).`,
    );
    return null;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('[auth] ADMIN_AUTH_SECRET est absent : connexion à /pam impossible.');
    return null;
  }
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = createHmac('sha256', 'pam-admin-dev')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('base64');
  }
  return ephemeralDevSecret;
}

function sign(payload: string): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export async function adminLogin(usernameOrEmail: string, password: string): Promise<{ success: boolean; error?: string }> {
  // La limite est posée avant toute vérification : c'est elle qui rend le
  // bourrage d'identifications coûteux. Le message reste identique à celui d'un
  // échec de credentials pour ne rien révéler sur l'existence du compte.
  const ip = await getClientIp();
  const attempt = rateLimit(`pam-login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_MS);
  if (!attempt.ok) {
    return { success: false, error: rateLimitMessage(attempt.retryAfterSeconds) };
  }

  try {
    const [admin] = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.username, usernameOrEmail.trim()))
      .limit(1);

    if (!admin) {
      return { success: false, error: 'Identifiants invalides' };
    }

    if (!admin.isActive) {
      return { success: false, error: 'Compte désactivé' };
    }

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) {
      return { success: false, error: 'Identifiants invalides' };
    }

    const payload = `${admin.id}.${Date.now()}`;
    const signature = sign(payload);
    if (!signature) {
      return {
        success: false,
        error: 'Administration non configurée : ADMIN_AUTH_SECRET est requis (32 caractères minimum).',
      };
    }
    const token = `${payload}.${signature}`;

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      path: '/pam',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE,
    });

    await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, admin.id));

    return { success: true };
  } catch (error) {
    console.error('adminLogin error:', error);
    return { success: false, error: 'Erreur lors de la connexion' };
  }
}

export async function adminLogout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/pam/login');
}

export interface AdminSession {
  id: string;
  username: string;
  email: string;
  displayName?: string;
  isRoot: boolean;
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  try {
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [id, issuedAt, signature] = parts;

    // Expiration : l'horodatage était signé mais jamais comparé à l'heure
    // courante. Un cookie volé restait donc valide indéfiniment, alors que le
    // navigateur, lui, l'oubliait au bout de 8 h.
    const issuedAtMs = Number(issuedAt);
    if (!Number.isFinite(issuedAtMs) || issuedAtMs <= 0) return null;
    const ageMs = Date.now() - issuedAtMs;
    if (ageMs < 0 || ageMs > SESSION_MAX_AGE * 1000) return null;

    const payload = `${id}.${issuedAt}`;
    const expected = sign(payload);
    if (!expected || !safeEqual(expected, signature)) return null;

    const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
    if (!admin || !admin.isActive) return null;

    return {
      id: admin.id,
      username: admin.username,
      email: admin.email,
      displayName: admin.displayName || undefined,
      isRoot: admin.isRoot,
    };
  } catch (error) {
    console.error('getAdminSession error:', error);
    return null;
  }
}

export async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) redirect('/pam/login');
  return session;
}
