import type { Metadata } from "next";
import { Inter } from "next/font/google";
import NextTopLoader from 'nextjs-toploader';
import "./globals.css";
import Providers from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "POS Market | Votre Marketplace Express Premium",
  description: "Découvrez les meilleures boutiques et produits sur notre marketplace ultra-rapide. Vendez et achetez en toute sécurité.",
  keywords: "marketplace, shopping, e-commerce, boutique en ligne, vente express",
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
          height={3}
          crawl={true}
          showSpinner={true}
          easing="ease"
          speed={200}
          shadow="0 0 10px #f56b2a, 0 0 5px #f56b2a"
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
