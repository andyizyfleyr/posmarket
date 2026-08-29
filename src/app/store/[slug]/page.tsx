import type { Metadata } from "next";
import { StorefrontWrapper } from "@/components/StorefrontWrapper";
import { fetchMarketplaceData, submitCheckoutAction, saveProductReviewAction, notifyCartInterestAction, notifyPostCheckoutAction } from "@/app/actions/marketplace";
import { getStoreSeo, absoluteImage } from "@/utils/catalog-seo";

export const revalidate = 60;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const store = await getStoreSeo(slug);
    if (!store) {
        return { title: "Boutique introuvable", robots: { index: false } };
    }
    const name = store.settings?.name || "Boutique";
    const desc =
        store.settings?.description?.slice(0, 155) ||
        `Découvrez la boutique ${name} sur PosMarket. Livraison express au Sénégal.`;
    const img = absoluteImage(store.settings?.logo);
    return {
        title: `${name} — Boutique officielle`,
        description: desc,
        alternates: { canonical: `/store/${store.slug || store.id}` },
        openGraph: {
            type: "website",
            title: name,
            description: desc,
            images: img ? [{ url: img }] : undefined,
        },
    };
}

export default async function StorePage({ params }: Props) {
    const { slug } = await params;
    const [stores, store] = await Promise.all([
        fetchMarketplaceData(),
        getStoreSeo(slug),
    ]);

    let jsonLd: Record<string, unknown>[] | null = null;
    if (store) {
        const products = (store.products || []).slice(0, 25);
        const site = process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-topaz.vercel.app";
        jsonLd = [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Accueil", item: `${site}/` },
                    { "@type": "ListItem", position: 2, name: store.settings?.name || "Boutique" },
                ],
            },
            {
            "@context": "https://schema.org",
            "@type": "Store",
            name: store.settings?.name,
            description: store.settings?.description || undefined,
            image: absoluteImage(store.settings?.logo),
            telephone: store.phone || undefined,
            ...(Number.isFinite(store.rating) && {
                aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: store.rating,
                },
            }),
            hasOfferCatalog: {
                "@type": "OfferCatalog",
                itemListElement: products.map((p) => ({
                    "@type": "Offer",
                    itemOffered: {
                        "@type": "Product",
                        name: p.name,
                        url: `/product/${p.id}`,
                        image: absoluteImage(p.image),
                    },
                    priceCurrency: "XOF",
                    price: Math.round(p.price || 0),
                })),
            },
            },
        ];
    }

    return (
        <>
            {jsonLd && (
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
                />
            )}
            <StorefrontWrapper
                stores={stores}
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
