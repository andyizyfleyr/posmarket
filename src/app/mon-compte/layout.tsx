import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/app/actions/session';
import { canAccessBuyerSpace, landingPathFor, resolveAccountAccess } from '@/utils/account-access';

/**
 * Garde de l'espace compte acheteur `/mon-compte`.
 *
 * Un vendeur (ou un administrateur) n'a rien à y faire : il est renvoyé vers
 * son espace. La redirection est faite côté serveur, avant le moindre rendu,
 * pour éviter d'afficher l'onglet acheteur puis de le remplacer.
 *
 * Sans session, on laisse passer : le client affiche la modale de connexion
 * (comportement historique de la page, cf. `StorefrontView`).
 */
export default async function MonCompteLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getCurrentSession();

  if (user) {
    const access = await resolveAccountAccess(user.id);
    if (!canAccessBuyerSpace(access.space)) {
      redirect(landingPathFor(access.space));
    }
  }

  return <>{children}</>;
}
