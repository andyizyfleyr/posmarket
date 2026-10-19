import { signIn } from '@/auth';
import { findProfileForAuth, setAuthIntentCookie } from '@/lib/auth-signin';
import { getClientIp, rateLimit, rateLimitMessage } from '@/lib/rate-limit';

/** 5 demandes de lien par quart d'heure : évite le flood d'emails et l'énumération. */
const MAGIC_LINK_LIMIT = 5;
const MAGIC_LINK_WINDOW_MS = 15 * 60 * 1000;

/**
 * Demande de lien magique pour l'espace vendeur.
 *
 * Partagé par les server actions du site (`/login`) et par la route mobile
 * `/api/marketplace/seller/auth/login`, afin que les deux appliquent
 * exactement les mêmes contrôles : limite de débit, existence du compte,
 * séparation stricte des rôles (un acheteur ne se connecte pas ici).
 */
export async function sendMagicLinkForSeller(opts: {
  email?: string;
  name?: string;
  target: string;
  register: boolean;
}): Promise<{ error: string } | { success: true; email: string }> {
  const email = String(opts.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return { error: 'Adresse email invalide.' };
  }

  // Deux clefs : par adresse (bloque l'énumération de comptes et le flood sur
  // une cible) et par IP (bloque le balayage d'une liste d'adresses).
  const ip = await getClientIp();
  const perEmail = rateLimit(`seller-magic-link:email:${email}`, MAGIC_LINK_LIMIT, MAGIC_LINK_WINDOW_MS);
  const perIp = rateLimit(`seller-magic-link:ip:${ip}`, MAGIC_LINK_LIMIT * 4, MAGIC_LINK_WINDOW_MS);
  if (!perEmail.ok) return { error: rateLimitMessage(perEmail.retryAfterSeconds) };
  if (!perIp.ok) return { error: rateLimitMessage(perIp.retryAfterSeconds) };

  const account = await findProfileForAuth(email).catch(() => null);
  if (!opts.register && !account) {
    return { error: 'Aucun compte commerçant n’est associé à cet email. Créez votre compte.' };
  }
  if (opts.register && account) {
    return { error: 'Un compte existe déjà avec cet email. Connectez-vous.' };
  }
  if (!opts.register && account && account.accountType !== 'seller') {
    const isAdmin = account.accountType === 'admin' || account.isSuperAdmin;
    return {
      error: isAdmin
        ? 'Cet email est associé à un compte administrateur. Connectez-vous depuis l’espace admin.'
        : 'Cet email est associé à un compte acheteur. Connectez-vous depuis l’espace client.',
    };
  }
  await setAuthIntentCookie({ intent: 'seller', name: opts.name?.trim() || undefined });
  try {
    const result = await signIn('email', { email, redirect: false, callbackUrl: opts.target });
    if (result?.error) {
      return { error: String(result.error) };
    }
    return { success: true, email };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Erreur lors de l’envoi du lien de connexion.',
    };
  }
}
