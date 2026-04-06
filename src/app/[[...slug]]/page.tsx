import { fetchMarketplaceData, submitCheckoutAction, saveProductReviewAction, notifyCartInterestAction, notifyPostCheckoutAction } from '@/app/actions/marketplace';
import { StorefrontWrapper } from '@/components/StorefrontWrapper';

// Next.js ISR: Cache the page on Vercel CDN for 60 seconds to eliminate Server TTFB delay.
export const revalidate = 60;

export default async function MarketplacePage() {
    const stores = await fetchMarketplaceData();

    return (
        <StorefrontWrapper 
            stores={stores} 
            onBackToApp={async () => {
                'use server';
                // Handled by client-side router usually, but providing a server action if needed
            }}
            onMarketplaceCheckout={submitCheckoutAction}
            onAddReview={saveProductReviewAction}
            onNotifyCartInterest={notifyCartInterestAction}
            onNotifyPostCheckout={notifyPostCheckoutAction}
        />
    );
}
