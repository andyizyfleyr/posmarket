import { fetchMarketplaceData } from "@/app/actions/marketplace";
import { generateProductSlug } from "@/utils/slug";

export function findProductInCatalog(
    stores: any[],
    slugOrId: string,
): { product: any; store: any } | null {
    for (const store of stores) {
        for (const product of store.products || []) {
            if (
                product.id === slugOrId ||
                generateProductSlug(product) === slugOrId
            ) {
                return { product, store };
            }
        }
    }
    return null;
}

export function findStoreInCatalog(stores: any[], slugOrId: string) {
    return (
        stores.find(
            (s) => s.slug === slugOrId || s.id === slugOrId,
        ) || null
    );
}

export async function getCatalog() {
    return fetchMarketplaceData();
}

export function absoluteImage(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//.test(url)) return url;
    const base =
        process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-topaz.vercel.app";
    return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
}
