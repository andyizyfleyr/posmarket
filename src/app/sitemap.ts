import type { MetadataRoute } from "next";
import { getCatalog } from "@/utils/catalog-seo";
import { generateProductSlug } from "@/utils/slug";

const SITE =
    process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-topaz.vercel.app";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const entries: MetadataRoute.Sitemap = [
        { url: `${SITE}/`, changeFrequency: "daily", priority: 1 },
    ];

    try {
        const stores = await getCatalog();
        for (const store of stores) {
            const storeSlug = store.slug || store.id;
            entries.push({
                url: `${SITE}/store/${storeSlug}`,
                changeFrequency: "daily",
                priority: 0.8,
            });
            for (const product of (store.products || []).slice(0, 500)) {
                entries.push({
                    url: `${SITE}/product/${generateProductSlug(product)}`,
                    changeFrequency: "weekly",
                    priority: 0.6,
                });
            }
        }
    } catch {
        // Sitemap still returns home if catalog fetch fails
    }

    return entries.slice(0, 10000);
}
