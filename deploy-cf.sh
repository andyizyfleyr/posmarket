#!/bin/bash
# Deployment script for Cloudflare Pages

set -e

echo "🔄 Building for Cloudflare..."

# Build the Next.js application
npx next build

# Build for Cloudflare using next-on-pages
npx @cloudflare/next-on-pages

echo "🚀 Deploying to Cloudflare Pages..."

# Deploy using wrangler
npx wrangler pages deploy .vercel/output/static --project-name=posmarket

echo "✅ Deployment complete!"
