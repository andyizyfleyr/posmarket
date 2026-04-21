import type { NextConfig } from "next";
import { getLocalIp } from "./lib/getLocalIp";

const ip = getLocalIp();

const nextConfig: NextConfig = {
  allowedDevOrigins: [ip],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'updrjzaapvbtjdnpicra.supabase.co' },
    ],
  },

  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
      allowedOrigins: [
        `http://localhost:3000`,
        `http://${ip}:3000`,
      ],
    },
  },
};

export default nextConfig;