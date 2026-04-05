import { fetchMarketplaceData, submitCheckoutAction, saveProductReviewAction } from '@/app/actions/marketplace';
import { StorefrontWrapper } from '@/components/StorefrontWrapper';

// Next.js 15: No longer need force-dynamic if using cookies/headers correctly, 
// but for storefront data we want it fresh.
export const dynamic = 'force-dynamic';

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
        />
    );
}
