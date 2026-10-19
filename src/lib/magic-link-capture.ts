/**
 * Capture du lien magique pour l'application mobile.
 *
 * La route `/api/marketplace/auth/login` (appelée par l'app) demande un lien
 * de connexion acheteur puis l'échange **côté serveur** contre le cookie de
 * session Auth.js, qu'elle renvoie à l'app. Sans ce créneau de capture, l'app
 * ne pourrait jamais terminer la connexion (le lien part par e-mail et
 * s'ouvre dans le navigateur, pas dans l'app).
 *
 * Le créneau est ouvert juste avant `signIn('email')` et refermé aussitôt
 * après : les demandes web (formulaire du site) ne sont jamais concernées et
 * continuent de recevoir leur e-mail normalement.
 */

/** Créneaux ouverts, par adresse e-mail : `null` = ouvert sans lien encore capturé. */
const slots = new Map<string, string | null>();

const keyOf = (email: string) => String(email || '').trim().toLowerCase();

/** Ouvre un créneau de capture pour cette adresse. */
export function openMagicLinkCapture(email: string): void {
  const key = keyOf(email);
  if (key) slots.set(key, null);
}

/**
 * Enregistre le lien généré par Auth.js. Renvoie `true` si un créneau était
 * ouvert (le lien sera consommé par le serveur, inutile d'envoyer l'e-mail).
 */
export function captureMagicLinkUrl(email: string | undefined | null, url: string): boolean {
  const key = keyOf(String(email || ''));
  if (!key || !slots.has(key)) return false;
  slots.set(key, url);
  return true;
}

/** Referme le créneau et renvoie le lien capturé (ou `null`). */
export function closeMagicLinkCapture(email: string): string | null {
  const key = keyOf(email);
  const url = slots.get(key) ?? null;
  slots.delete(key);
  return url;
}
