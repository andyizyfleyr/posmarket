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

export async function saveSession(session: StoredSession | null): Promise<void> {
  cached = session;
  loaded = true;
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
