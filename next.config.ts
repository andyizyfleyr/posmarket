import type { NextConfig } from "next";
import { getLocalIp } from "./lib/getLocalIp";

const ip = getLocalIp();

const nextConfig: NextConfig = {
  allowedDevOrigins: [ip],

  reactCompiler: true,

  images: {
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