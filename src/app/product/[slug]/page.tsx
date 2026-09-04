import type { Metadata } from "next";
import { StorefrontWrapper } from "@/components/StorefrontWrapper";
import { fetchMarketplaceData, submitCheckoutAction, saveProductReviewAction, notifyCartInterestAction, notifyPostCheckoutAction } from "@/app/actions/marketplace";
import { getProductSeo, absoluteImage } from "@/utils/catalog-seo";

export const revalidate = 60;
export const dynamicParams = true;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    const found = await getProductSeo(slug);
    if (!found) {
        return { title: "Produit introuvable", robots: { index: false } };
    }
    const { product, store } = found;
    const name = product.name || "Produit";
    const price = Math.round(product.price || 0);
    const desc =
        product.description?.slice(0, 155) ||
        `Achetez ${name} à ${price} FCFA sur PosMarket. Livraison express partout au Sénégal.`;
    const img = absoluteImage(product.image);
    return {
        title: `${name} — ${store.settings?.name || "PosMarket"}`,
        description: desc,
        alternates: { canonical: `/product/${product.id}` },
        openGraph: {
            type: "website",
            title: name,
            description: desc,
            images: img ? [{ url: img }] : undefined,
        },
        twitter: {
            card: "summary_large_image",
            title: name,
            description: desc,
            images: img ? [img] : undefined,
        },
    };
}

export default async function ProductPage({ params }: Props) {
    const { slug } = await params;
    const [stores, found] = await Promise.all([
        fetchMarketplaceData(),
        getProductSeo(slug),
    ]);

    let jsonLd: Record<string, unknown>[] | null = null;
    if (found) {
        const { product, store } = found;
        const storeName = store.settings?.name || "PosMarket";
        const storeSlug = store.slug || store.id;
        const site = process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-eight.vercel.app";
        jsonLd = [
            {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Accueil", item: `${site}/` },
                    { "@type": "ListItem", position: 2, name: storeName, item: `${site}/store/${storeSlug}` },
                    { "@type": "ListItem", position: 3, name: product.name },
                ],
            },
            {
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.name,
            description: product.description || undefined,
            image: absoluteImage(product.image),
            brand: { "@type": "Brand", name: store.settings?.name || "PosMarket" },
            offers: {
                "@type": "Offer",
                priceCurrency: "XOF",
                price: Math.round(product.price || 0),
                availability:
                    (product.stock ?? 1) > 0
                        ? "https://schema.org/InStock"
                        : "https://schema.org/OutOfStock",
                url: `/product/${product.id}`,
                seller: { "@type": "Organization", name: store.settings?.name || "PosMarket" },
            },
            ...((product.rating || product.reviewCount) && {
                aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: product.rating || undefined,
                    reviewCount: product.reviewCount || undefined,
                },
            }),
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
