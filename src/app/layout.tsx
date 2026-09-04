import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from 'nextjs-toploader';
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://posmarket-eight.vercel.app",
  ),
  title: {
    default: "PosMarket | Votre Marketplace Express Premium",
    template: "%s | PosMarket",
  },
  description:
    "Découvrez les meilleures boutiques et produits sur notre marketplace ultra-rapide. Vendez et achetez en toute sécurité.",
  keywords: [
    "PosMarket",
    "marketplace",
    "shopping",
    "e-commerce",
    "boutique en ligne",
    "vente express",
  ],
  applicationName: "PosMarket",
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "PosMarket",
    title: "PosMarket | Votre Marketplace Express Premium",
    description:
      "Découvrez les meilleures boutiques et produits sur notre marketplace ultra-rapide. Vendez et achetez en toute sécurité.",
  },
  twitter: {
    card: "summary_large_image",
    title: "PosMarket | Votre Marketplace Express Premium",
    description:
      "Découvrez les meilleures boutiques et produits sur notre marketplace ultra-rapide. Vendez et achetez en toute sécurité.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <NextTopLoader 
          color="#f56b2a"
          initialPosition={0.08}
          crawlSpeed={200}
          height={4}
          crawl={true}
          showSpinner={false}
          easing="ease-in-out"
          speed={400}
          shadow="0 0 15px #f56b2a, 0 0 5px #f56b2a"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
