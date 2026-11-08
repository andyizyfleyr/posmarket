import { submitCheckoutAction } from '@/app/actions/checkout';
import { fetchMarketplaceData, notifyCartInterestAction, notifyPostCheckoutAction } from '@/app/actions/marketplace';
import { getHomepageLayout } from '@/lib/homepage-layout';
import { StorefrontWrapper } from '@/components/StorefrontWrapper';

// La garde de rôle vit dans `layout.tsx` : elle dépend de la session, la page
// ne doit donc jamais être mise en cache statiquement.
export const dynamic = 'force-dynamic';

/**
 * `/mon-compte` et ses onglets (`/mon-compte/commandes`, `/mon-compte/profil`, …).
 *
 * Le rendu passe par la même `StorefrontWrapper` que le catalogue : la vue
 * acheteur est un calque au-dessus de la vitrine, c'est `StorefrontView` qui
 * route l'onglet actif depuis `location.pathname`.
 */
export default async function MonComptePage() {
    const [stores, homepageLayout] = await Promise.all([
        fetchMarketplaceData(),
        getHomepageLayout(),
    ]);

    return (
        <StorefrontWrapper
            stores={stores}
            homepageLayout={homepageLayout}
            onBackToApp={async () => {
                'use server';
                // Navigation client, rien à faire côté serveur.
            }}
            onMarketplaceCheckout={submitCheckoutAction}
            onNotifyCartInterest={notifyCartInterestAction}
            onNotifyPostCheckout={notifyPostCheckoutAction}
        />
    );
}
