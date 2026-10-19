import { headers } from 'next/headers';
import { decode } from 'next-auth/jwt';

/**
 * Session mobile portée par en-tête.
 *
 * React Native (fetch → XHR → OkHttp) ne transmet pas de façon fiable
 * l'en-tête `Cookie` : le pot à cookies natif d'OkHttp peut remplacer celui
 * qu'on pose à la main (`BridgeInterceptor`), ce qui rend la session
 * systématiquement refusée côté serveur (« Connexion réussie » puis
 * déconnexion). L'application envoie donc le même jeton de session Auth.js
 * dans `Authorization: Bearer …` (et garde le cookie par ailleurs).
 *
 * Le jeton est exactement celui du cookie de session : on le décode avec le
 * même secret (`AUTH_SECRET`) et le même sel (nom du cookie), puis on lit
 * l'identifiant du profil comme le fait `auth()`.
 */

/** Noms possibles du cookie de session Auth.js (préfixe HTTPS ou non). */
const SESSION_COOKIE_NAMES = ['__Secure-authjs.session-token', 'authjs.session-token'];

/** Identifiant utilisateur porté par le jeton de session de la requête. */
export async function getMobileSessionUserId(): Promise<string | null> {
  try {
    const headerStore = await headers();
    const raw =
      (headerStore.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
      (headerStore.get('x-posmarket-session') || '').trim();
    if (!raw) return null;

    const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!secret) return null;

    for (const salt of SESSION_COOKIE_NAMES) {
      try {
        const token = await decode({ token: raw, secret, salt });
        const id = token?.id ?? token?.sub;
        if (id) return String(id);
      } catch {
        // Sel suivant (environnement local sans préfixe sécurisé).
      }
    }
  } catch {
    // Hors requête (rendu statique, script) : pas de session mobile.
  }
  return null;
}
