import type { Metadata } from "next";
import { StorefrontWrapper } from "@/components/StorefrontWrapper";
import { fetchMarketplaceData, submitCheckoutAction, saveProductReviewAction, notifyCartInterestAction, notifyPostCheckoutAction } from "@/app/actions/marketplace";
import { MAIN_CATEGORIES } from "@/constants";

export const revalidate = 60;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

function decodeCategorySlug(slug: string): string {
    return decodeURIComponent(slug);
}

export function generateStaticParams() {
    return MAIN_CATEGORIES.map((cat) => ({ slug: encodeURIComponent(cat) }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const category = decodeCategorySlug(slug);
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-topaz.vercel.app";
    return {
        title: `${category}`,
        description: `Découvrez tous les produits de la catégorie ${category} sur PosMarket.`,
        alternates: { canonical: `/category/${slug}` },
        openGraph: {
            type: "website",
            title: `${category} · PosMarket`,
            description: `Découvrez tous les produits de la catégorie ${category} sur PosMarket.`,
            url: `${site}/category/${slug}`,
            locale: "fr_FR",
            siteName: "PosMarket",
        },
    };
}

export default async function CategoryPage({ params }: Props) {
    const { slug } = await params;
    const category = decodeCategorySlug(slug);
    const site = process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-topaz.vercel.app";
    const stores = await fetchMarketplaceData();

    const categoryProducts = (stores || [])
        .flatMap((s) => (s.products || []).map((p) => ({ ...p, __storeName: s.settings?.name || s.name || "" })))
        .filter((p) => {
            const c = p.category || "";
            const m = (p as { mainCategory?: string }).mainCategory || "";
            return c === category || m === category;
        })
        .slice(0, 20);

    return (
        <>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{
                    __html: JSON.stringify({
                        "@context": "https://schema.org",
                        "@type": "ItemList",
                        name: category,
                        itemListElement: categoryProducts.map((p, i) => ({
                            "@type": "ListItem",
                            position: i + 1,
                            name: p.name,
                            url: `${site}/product/${p.id}`,
                        })),
                    }),
                }}
            />
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
        </>
    );
}
