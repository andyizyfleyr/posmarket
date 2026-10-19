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
 * continuent de recevoir leur e-mail normalement. Par sécurité il expire au
 * bout d'une minute : une erreur inattendue (crash, timeout) ne peut donc
 * jamais étouffer durablement les e-mails d'une adresse.
 */

interface CaptureSlot {
  /** Lien capturé (`null` tant que `sendVerificationRequest` n'a pas répondu). */
  url: string | null;
  openedAt: number;
}

/** Au-delà, le créneau est mort : les envois d'e-mails reprennent normalement. */
const CAPTURE_TTL_MS = 60_000;

/** Créneaux ouverts, par adresse e-mail. */
const slots = new Map<string, CaptureSlot>();

const keyOf = (email: string) => String(email || '').trim().toLowerCase();

/** Créneau encore valide, purgé s'il est expiré. */
function liveSlot(email: string): CaptureSlot | null {
  const key = keyOf(email);
  if (!key) return null;
  const slot = slots.get(key);
  if (!slot) return null;
  if (Date.now() - slot.openedAt > CAPTURE_TTL_MS) {
    slots.delete(key);
    return null;
  }
  return slot;
}

/** Ouvre un créneau de capture pour cette adresse. */
export function openMagicLinkCapture(email: string): void {
  const key = keyOf(email);
  if (key) slots.set(key, { url: null, openedAt: Date.now() });
}

/**
 * Enregistre le lien généré par Auth.js. Renvoie `true` si un créneau était
 * ouvert (le lien sera consommé par le serveur, inutile d'envoyer l'e-mail).
 */
export function captureMagicLinkUrl(email: string | undefined | null, url: string): boolean {
  const slot = liveSlot(String(email || ''));
  if (!slot) return false;
  slot.url = url;
  return true;
}

/** Referme le créneau et renvoie le lien capturé (ou `null`). */
export function closeMagicLinkCapture(email: string): string | null {
  const key = keyOf(email);
  const slot = key ? liveSlot(key) : null;
  if (!key) return null;
  slots.delete(key);
  return slot?.url ?? null;
}
