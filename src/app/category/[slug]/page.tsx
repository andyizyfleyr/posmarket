import type { Metadata } from "next";
import { StorefrontWrapper } from "@/components/StorefrontWrapper";
import { fetchMarketplaceData, submitCheckoutAction, saveProductReviewAction, notifyCartInterestAction, notifyPostCheckoutAction } from "@/app/actions/marketplace";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string }> };

function decodeCategorySlug(slug: string): string {
    return decodeURIComponent(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const category = decodeCategorySlug(slug);
    return {
        title: `${category}`,
        description: `Découvrez tous les produits de la catégorie ${category} sur PosMarket.`,
        alternates: { canonical: `/category/${slug}` },
    };
}

export default async function CategoryPage({ params }: Props) {
    const { slug } = await params;
    const category = decodeCategorySlug(slug);
    const stores = await fetchMarketplaceData();

    return (
        <StorefrontWrapper
            stores={stores}
            initialCategory={category}
            onBackToApp={async () => {
                "use server";
            }}
            onMarketplaceCheckout={submitCheckoutAction}
            onAddReview={saveProductReviewAction}
            onNotifyCartInterest={notifyCartInterestAction}
            onNotifyPostCheckout={notifyPostCheckoutAction}
        />
    );
}
