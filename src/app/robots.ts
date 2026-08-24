import type { MetadataRoute } from "next";

const SITE =
    process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-topaz.vercel.app";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: "*",
                allow: "/",
                disallow: ["/dashboard", "/pos", "/inventory", "/orders", "/customers", "/settings", "/admin", "/api/"],
            },
        ],
        sitemap: `${SITE}/sitemap.xml`,
    };
}
