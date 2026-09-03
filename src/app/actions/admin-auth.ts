'use server';

import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { db } from '@/db';
import { adminUsers } from '@/db/schema';
import { eq } from 'drizzle-orm';

const SESSION_COOKIE = 'pam_admin_session';
const SESSION_MAX_AGE = 60 * 60 * 8; // 8 heures

function getSigningSecret(): string {
  // Secret de signature stable, dérivé de DATABASE_URL si ADMIN_AUTH_SECRET absent.
  return process.env.ADMIN_AUTH_SECRET || createHmac('sha256', 'pam-admin').update(process.env.DATABASE_URL || '').digest('base64');
}

function sign(payload: string): string {
  const hmac = createHmac('sha256', getSigningSecret());
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
    const token = `${payload}.${sign(payload)}`;

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
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [id, , signature] = parts;
    const payload = `${id}.${parts[1]}`;
    if (!safeEqual(sign(payload), signature)) return null;

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
