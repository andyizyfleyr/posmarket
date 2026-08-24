import { db } from "@/db";
import { stores, products, productStats } from "@/db/schema";
import { eq, or, and, like, sql } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { generateProductSlug } from "@/utils/slug";

const SITE =
    process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-topaz.vercel.app";

export function absoluteImage(url?: string | null): string | undefined {
    if (!url) return undefined;
    if (/^https?:\/\//.test(url)) return url;
    return `${SITE}${url.startsWith("/") ? "" : "/"}${url}`;
}

const imgSql = () =>
    sql<
        string | null
    >`CASE WHEN ${products.image} LIKE 'data:%' THEN NULL ELSE ${products.image} END`;

function imgRef(
    uri: string | null | undefined,
    hasImage: boolean | null | undefined,
    apiId: string,
): string {
    return uri || (hasImage ? `/api/image/${apiId}` : "");
}

/**
 * Dedicated lightweight query for product metadata/JSON-LD.
 * Matches by exact id OR by public slug (name-slug ending with id prefix).
 * Never loads the full catalog.
 */
async function getProductSeoUncached(
    slugOrId: string,
): Promise<{ product: any; store: any } | null> {
    try {
        const wanted = decodeURIComponent(slugOrId);
        const idPrefix = wanted.split("-").pop() || "";
        const rows = await db
            .select({
                id: products.id,
                storeId: products.storeId,
                name: products.name,
                description: products.description,
                price: products.price,
                originalPrice: products.originalPrice,
                stock: products.stock,
                image: imgSql(),
                hasImage:
                    sql<boolean>`${products.image} IS NOT NULL` as any,
                avgRating: productStats.averageRating,
                reviewCount: productStats.reviewCount,
                storeName: stores.name,
                storeSlug: stores.slug,
                storePhone: stores.phone,
            })
            .from(products)
            .innerJoin(stores, eq(products.storeId, stores.id))
            .leftJoin(productStats, eq(productStats.productId, products.id))
            .where(
                and(
                    eq(products.isOnline, true),
                    or(
                        sql`${products.id}::text = ${wanted}`,
                        sql`${products.id}::text LIKE ${idPrefix + "%"}`,
                    ),
                ),
            )
            .limit(10);

        const row = rows.find(
            (r) =>
                r.id === wanted ||
                generateProductSlug({ id: r.id, name: r.name }) === wanted,
        );
        if (!row) return null;

        return {
            product: {
                id: row.id,
                name: row.name,
                description: row.description || "",
                price: Number(row.price) || 0,
                stock: row.stock || 0,
                image: imgRef(row.image as string | null, row.hasImage, row.id),
                rating: row.avgRating ? parseFloat(row.avgRating as any) : 0,
                reviewCount: row.reviewCount
                    ? parseInt(row.reviewCount as any)
                    : 0,
            },
            store: {
                id: row.storeId,
                slug: row.storeSlug,
                phone: row.storePhone || "",
                settings: { name: row.storeName },
            },
        };
    } catch {
        return null;
    }
}

export const getProductSeo = unstable_cache(getProductSeoUncached, ["product-seo"], {
    tags: ["marketplace"],
    revalidate: 300,
});

/** Lightweight single-store query with its online products (SEO/JSON-LD). */
async function getStoreSeoUncached(slugOrId: string) {
    try {
        const s = decodeURIComponent(slugOrId);
        const [row] = await db
            .select({
                id: stores.id,
                slug: stores.slug,
                name: stores.name,
                phone: stores.phone,
                address: stores.address,
                description: stores.description,
                settings: stores.settings,
                hasLogo: sql<boolean>`(${stores.settings} -> 'logo') IS NOT NULL`,
            })
            .from(stores)
            .where(or(eq(stores.slug, s), sql`${stores.id}::text = ${s}`))
            .limit(1);
        if (!row) return null;

        const prodRows = await db
            .select({
                id: products.id,
                name: products.name,
                price: products.price,
                image: imgSql(),
                hasImage: sql<boolean>`${products.image} IS NOT NULL`,
            })
            .from(products)
            .where(and(eq(products.storeId, row.id), eq(products.isOnline, true)))
            .limit(50);

        const settingsObj: Record<string, unknown> = {
            ...((row.settings as Record<string, unknown>) || {}),
        };
        if (row.hasLogo) settingsObj.logo = `/api/image/s${row.id}`;

        return {
            id: row.id,
            slug: row.slug,
            phone: row.phone || "",
            rating: 0,
            settings: {
                name: row.name,
                description:
                    row.description ||
                    ((settingsObj.description as string) || ""),
                logo: settingsObj.logo as string | undefined,
            },
            products: prodRows.map((p: any) => ({
                id: p.id,
                name: p.name,
                price: Number(p.price) || 0,
                image: imgRef(p.image, p.hasImage, p.id),
            })),
        };
    } catch {
        return null;
    }
}

export const getStoreSeo = unstable_cache(getStoreSeoUncached, ["store-seo"], {
    tags: ["marketplace"],
    revalidate: 300,
});
