#!/bin/bash

# Build script for Render deployment

echo "🚀 Starting OneKeel Swarm build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application for Render (without Replit dependencies)
echo "🔨 Building application..."
vite build --config vite.config.render.ts && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:push

echo "✅ Build completed successfully!"