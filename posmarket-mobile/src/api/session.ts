/**
 * Session acheteur de l'application mobile.
 *
 * Le serveur (Auth.js) délivre la session sous forme de cookie ; l'app la
 * stocke telle quelle et la renvoie dans l'en-tête `Cookie` de chaque appel
 * API — c'est ce qui donne accès aux commandes, adresses, avis et au profil.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_KEY = 'posmarket_buyer_session';

export interface StoredSession {
  /** Nom du cookie Auth.js (`authjs.session-token` ou `__Secure-…`). */
  name: string;
  value: string;
}

let cached: StoredSession | null = null;
let loaded = false;
let inflight: Promise<StoredSession | null> | null = null;

/**
 * Incrémenté à chaque changement de session (connexion, déconnexion,
 * expiration). Une requête partie avant le changement et refusée « Unauthorized »
 * à son retour est une réponse obsolète : elle ne doit pas purger la session
 * courante (voir `patchStaleAuth` dans `client.ts`).
 */
let version = 0;

/** Charge la session depuis le stockage (une seule fois, puis mémoïsée). */
export async function loadSession(): Promise<StoredSession | null> {
  if (loaded) return cached;
  if (inflight) return inflight;
  inflight = AsyncStorage.getItem(SESSION_KEY)
    .then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as StoredSession;
          cached = parsed?.name && parsed?.value ? parsed : null;
        } catch {
          cached = null;
        }
      }
      return cached;
    })
    .catch(() => null)
    .finally(() => {
      loaded = true;
      inflight = null;
    });
  return inflight;
}

/** Session en mémoire (peut être `null` tant que `loadSession` n'a pas fini). */
export function getSessionSync(): StoredSession | null {
  return cached;
}

/** Version de la session courante (voir le commentaire de `version`). */
export function sessionVersion(): number {
  return version;
}

export async function saveSession(session: StoredSession | null): Promise<void> {
  cached = session;
  loaded = true;
  version += 1;
  try {
    if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
}

/** En-tête `Cookie` prêt à poser sur un appel API. */
export async function sessionCookieHeader(): Promise<string | null> {
  const session = await loadSession();
  return session ? `${session.name}=${session.value}` : null;
}

/**
 * Jeton brut de la session, porté par `Authorization: Bearer …`.
 *
 * React Native (OkHttp) ne transmet pas de façon fiable un en-tête `Cookie`
 * posé à la main : le serveur accepte donc le même jeton de session dans
 * l'en-tête d'autorisation (voir `src/lib/mobile-session.ts` côté web).
 */
export async function sessionBearerToken(): Promise<string | null> {
  const session = await loadSession();
  return session?.value ?? null;
}
