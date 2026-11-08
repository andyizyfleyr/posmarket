import type { Metadata, Viewport } from "next";
import NextTopLoader from 'nextjs-toploader';
// Police auto-hébergée : `next/font/google` téléchargeait Inter au moment du
// build, ce qui faisait échouer `next build` dès que fonts.googleapis.com
// n'était pas joignable (CI isolée, panne DNS, environnement hors ligne).
// Le paquet `@fontsource-variable/inter` embarque les .woff2 dans le bundle :
// build déterministe, aucun appel réseau, et les polices sont servies depuis
// le même domaine (pas de requête tierce).
import "@fontsource-variable/inter";
import "./globals.css";
import Providers from "./providers";
import ImpersonationBanner from "@/components/ImpersonationBanner";

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "PosMarket",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
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
  themeColor: "#f56b2a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://pub-18d489375e4146f48984e82e8f24581f.r2.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
        <link rel="dns-prefetch" href="https://pub-18d489375e4146f48984e82e8f24581f.r2.dev" />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {/* Barre de progression des navigations. `showSpinner={false}` : le
            spinner du haut restait parfois bloqué après une navigation annulée
            (import abandonné, retour arrière), et se cumulait avec les
            indicateurs de chargement des pages. La barre seule suffit. */}
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
        <ImpersonationBanner />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
