import { submitCheckoutAction } from '@/app/actions/checkout';
import { fetchMarketplaceData, notifyCartInterestAction, notifyPostCheckoutAction } from '@/app/actions/marketplace';
import { getHomepageLayout } from '@/lib/homepage-layout';
import { StorefrontWrapper } from '@/components/StorefrontWrapper';

// Next.js ISR: Cache the page on Vercel CDN for 60 seconds to eliminate Server TTFB delay.
export const revalidate = 60;

export default async function MarketplacePage() {
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
                // Handled by client-side router usually, but providing a server action if needed
            }}
            onMarketplaceCheckout={submitCheckoutAction}
            onNotifyCartInterest={notifyCartInterestAction}
            onNotifyPostCheckout={notifyPostCheckoutAction}
        />
    );
}
