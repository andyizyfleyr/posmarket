import type { NextConfig } from "next";
import { getLocalIp } from "./lib/getLocalIp";

const ip = getLocalIp();

const nextConfig: NextConfig = {
  allowedDevOrigins: [ip],

  reactCompiler: true,

  images: {
    // Optimiseur Vercel désactivé (voir src/lib/imageLoader.ts) :
    // les octets sortent directement de R2 au lieu de transiter par l'edge.
    loader: 'custom',
    loaderFile: './src/lib/imageLoader.ts',
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'updrjzaapvbtjdnpicra.supabase.co' },
      { protocol: 'https', hostname: 'pub-18d489375e4146f48984e82e8f24581f.r2.dev' },
    ],
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // WebP uniquement : l'AVIF ajouterait une 2e génération lossy
    // sur des images déjà compressées en WebP par le vendeur.
    formats: ['image/webp'],
    qualities: [75, 90, 95],
    minimumCacheTTL: 86400,
    dangerouslyAllowSVG: false,
  },

  experimental: {
    // Les pages vendeur sont dynamiques, donc non mises en cache par défaut :
    // chaque retour sur une page déjà visitée relançait un rendu serveur
    // complet. 30 s de cache client rendent la navigation instantanée ; les
    // actions serveur (revalidatePath/revalidateTag) invalident ce cache dès
    // qu'une donnée change.
    staleTimes: {
      dynamic: 30,
      static: 300,
    },
    serverActions: {
      bodySizeLimit: '30mb',
      allowedOrigins: [
        `http://localhost:3000`,
        `http://${ip}:3000`,
      ],
    },
  },
};

export default nextConfig;