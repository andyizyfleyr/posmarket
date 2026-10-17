import type { Metadata } from "next";
import { StorefrontWrapper } from "@/components/StorefrontWrapper";
import {
    fetchMarketplaceData,
    submitCheckoutAction,
    notifyCartInterestAction,
    notifyPostCheckoutAction,
} from "@/app/actions/marketplace";

// Next.js ISR: cache la page 60 s sur le CDN Vercel.
export const revalidate = 60;

const site =
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://posmarket-eight.vercel.app";

export const metadata: Metadata = {
    title: "Vente en gros",
    description:
        "Découvrez tous les produits disponibles à la vente en gros sur PosMarket : tarifs dégressifs et remises quantitatives.",
    alternates: { canonical: `${site}/products/wholesale` },
    openGraph: {
        title: "Vente en gros",
        description:
            "Produits disponibles à la vente en gros avec tarifs dégressifs sur PosMarket.",
        url: `${site}/products/wholesale`,
        type: "website",
    },
};

export default async function WholesalePage() {
    const stores = await fetchMarketplaceData();

    return (
        <StorefrontWrapper
            stores={stores}
            initialCategory="wholesale"
            onBackToApp={async () => {
                "use server";
            }}
            onMarketplaceCheckout={submitCheckoutAction}
            onNotifyCartInterest={notifyCartInterestAction}
            onNotifyPostCheckout={notifyPostCheckoutAction}
        />
    );
}
