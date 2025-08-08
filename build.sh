#!/bin/bash

# Build script for Render deployment

echo "🚀 Starting OneKeel Swarm build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application for Render (without Replit dependencies)
echo "🔨 Building application..."
vite build --config vite.config.render.ts && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Run schema push
echo "🗄️ Running drizzle schema push..."
npm run db:push

# Run raw SQL migrations (idempotent)
echo "📑 Applying supplemental SQL migrations..."
npm run db:sql || echo "(Skipping supplemental SQL migrations if script not present)"

echo "✅ Build completed successfully!"