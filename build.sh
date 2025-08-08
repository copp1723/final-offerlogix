#!/bin/bash

# Build script for Render deployment

echo "🚀 Starting OneKeel Swarm build process..."

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build the application
echo "🔨 Building application..."
npm run build

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:push

echo "✅ Build completed successfully!"