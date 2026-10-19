import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { sendMagicLinkForSeller } from '@/lib/seller-magic-link';
import {
  closeMagicLinkCapture,
  openMagicLinkCapture,
} from '@/lib/magic-link-capture';

export const dynamic = 'force-dynamic';

/** Cookie de session Auth.js (avec ou sans préfixe sécurisé, jamais chunké ici). */
const SESSION_COOKIE_RE = /((?:__Secure-)?authjs\.session-token)=([^;,\s]+)/;

/**
 * POST /api/marketplace/seller/auth/login
 *
 * Connexion vendeur depuis l'application mobile. L'app ne peut pas ouvrir le
 * lien magique reçu par e-mail (il termine la session dans le navigateur) :
 * la route demande donc le même lien (mêmes contrôles que /login : limite de
 * débit, existence du compte, séparation stricte des rôles), l'échange
 * immédiatement contre le cookie de session Auth.js, et renvoie le cookie +
 * le profil à l'app.
 *
 * Corps : `{ email, name?, mode?: 'login' | 'register' }`
 * Réponse : `{ success, user, session: { name, value } }` ou `{ success, sent }`
 * quand un e-mail a dû être envoyé (repli).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const email = String(body?.email || '').trim().toLowerCase();
    const name = String(body?.name || '').trim();
    const mode = body?.mode === 'register' ? 'register' : 'login';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Adresse email invalide.' });
    }
    if (mode === 'register' && !name) {
      return NextResponse.json({ success: false, error: 'Veuillez saisir votre nom complet.' });
    }

    const target = mode === 'register' ? '/subscription' : '/dashboard';

    // 1) Demande de lien — identique à l'espace vendeur web (le lien est capturé).
    openMagicLinkCapture(email);
    const result = await sendMagicLinkForSeller({
      email,
      name: name || undefined,
      target,
      register: mode === 'register',
    });

    if ('error' in result) {
      closeMagicLinkCapture(email);
      return NextResponse.json({ success: false, error: result.error });
    }

    const magicUrl = closeMagicLinkCapture(email);
    if (!magicUrl) {
      // Aucun lien capturé (cas dégradé) : l'e-mail a été envoyé normalement.
      return NextResponse.json({ success: true, sent: true });
    }

    // 2) Échange du lien contre la session — la redirection n'est pas suivie.
    const callback = await fetch(magicUrl, {
      redirect: 'manual',
      headers: { 'X-PosMarket-Client': 'mobile-app' },
    }).catch(() => null);

    const rawSetCookie = callback
      ? typeof callback.headers.getSetCookie === 'function'
        ? callback.headers.getSetCookie().join('\n')
        : callback.headers.get('set-cookie') || ''
      : '';
    const match = rawSetCookie.match(SESSION_COOKIE_RE);

    if (!match) {
      // Le lien n'a pas produit de session : repli sur l'e-mail (nouveau lien,
      // cette fois envoyé pour de vrai), l'utilisateur clique dessus.
      const fallback = await sendMagicLinkForSeller({
        email,
        name: name || undefined,
        target,
        register: mode === 'register',
      });
      if ('error' in fallback) {
        return NextResponse.json({ success: false, error: fallback.error });
      }
      return NextResponse.json({ success: true, sent: true });
    }

    const [, cookieName, cookieValue] = match;

    // 3) Profil : le callback Auth.js l'a créé ou vérifié.
    const [profile] = await db
      .select({
        id: profiles.id,
        email: profiles.email,
        fullName: profiles.fullName,
        avatarUrl: profiles.avatarUrl,
        accountType: profiles.accountType,
        isSuperAdmin: profiles.isSuperAdmin,
      })
      .from(profiles)
      .where(eq(profiles.email, email))
      .limit(1);

    if (!profile || profile.accountType !== 'seller') {
      return NextResponse.json({ success: false, error: 'Connexion impossible pour ce compte.' });
    }

    return NextResponse.json({
      success: true,
      sent: false,
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.fullName || email.split('@')[0] || 'Commerçant',
        avatarUrl: profile.avatarUrl || null,
      },
      session: { name: cookieName, value: cookieValue },
    });
  } catch (error) {
    console.error('[API] seller/auth/login error:', error);
    return NextResponse.json(
      { success: false, error: 'Connexion impossible pour le moment. Réessayez.' },
      { status: 500 },
    );
  }
}
