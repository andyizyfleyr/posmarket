/**
 * Cache `localStorage` versionné et daté.
 *
 * Le navigateur n'invalide jamais tout seul une entrée `localStorage` : sans
 * version ni date, un cache écrit des semaines plus tôt peut continuer d'être
 * servi (prix, stocks, produits périmés). Chaque entrée porte donc sa version
 * et sa date ; toute entrée d'une autre version, trop vieille ou illisible est
 * supprimée au passage plutôt que réutilisée.
 *
 * Le cache reste un simple bonus : tout échec de stockage (quota, navigation
 * privée) est ignoré silencieusement.
 */

interface CacheEnvelope<T> {
  /** Version du format des données stockées. */
  v: number;
  /** Date d'écriture (ms epoch). */
  at: number;
  data: T;
}

export function writeLocalCache<T>(key: string, version: number, data: T): void {
  if (typeof window === "undefined") return;
  try {
    const envelope: CacheEnvelope<T> = { v: version, at: Date.now(), data };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Cache best-effort : quota dépassé / stockage interdit → on ignore.
  }
}

export function readLocalCache<T>(
  key: string,
  version: number,
  maxAgeMs: number,
  isValid?: (data: unknown) => boolean,
): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<unknown>> | null;
    const fresh =
      !!parsed &&
      parsed.v === version &&
      typeof parsed.at === "number" &&
      Date.now() - parsed.at < maxAgeMs;
    if (!fresh || (isValid && !isValid(parsed.data))) {
      localStorage.removeItem(key);
      return null;
    }
    return parsed.data as T;
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      // Rien à faire : l'entrée corrompue sera simplement ignorée.
    }
    return null;
  }
}

export function clearLocalCache(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    // Rien à faire.
  }
}
