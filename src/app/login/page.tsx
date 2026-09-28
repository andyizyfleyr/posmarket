import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/app/actions/session';
import {
  canAccessBuyerSpace,
  canAccessSellerSpace,
  landingPathFor,
  resolveAccountAccess,
} from '@/utils/account-access';
import SellerLoginForm from './SellerLoginForm';

/**
 * Chemins vers lesquels un vendeur peut être redirigé après connexion.
 *
 * Toute autre destination est ignorée : `?next=` ne doit pas pouvoir ouvrir une
 * page vendeur à un acheteur. L'espace vendeur reste protégé par son propre
 * layout — on évite seulement l'aller-retour inutile.
 */
const SELLER_LANDING = /^\/(dashboard|pos|orders|inventory|customers|invoices|reports|settings|subscription)(\/|$)/;

function sanitizeNext(raw: string | string[] | undefined): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  // Chemins internes uniquement : ni URL absolue, ni double slash (lu comme un
  // protocole relatif par le navigateur).
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

/**
 * Page de connexion vendeur.
 *
 * Elle est rendue côté serveur et résout la destination AVANT d'afficher le
 * formulaire : un vendeur déjà connecté qui arrive ici (par exemple après un
 * rebond du proxy sur une page protégée) est directement envoyé sur son
 * dashboard au lieu de retomber sur le formulaire de connexion.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = sanitizeNext(params?.next);

  const { user } = await getCurrentSession();

  if (user) {
    const access = await resolveAccountAccess(user.id);
    if (canAccessSellerSpace(access.space)) {
      redirect(next && SELLER_LANDING.test(next) ? next : '/dashboard');
    }
    if (!canAccessBuyerSpace(access.space)) {
      // Administrateur : l'espace d'administration PAM, pas la page vendeur.
      redirect(landingPathFor(access.space));
    }
    // Acheteur : la page de connexion vendeur n'a rien à lui proposer.
    redirect(landingPathFor(access.space));
  }

  return <SellerLoginForm next={next} />;
}
