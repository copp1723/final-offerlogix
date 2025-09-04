#!/bin/bash

echo "🚀 Starting OfferLogix Development Server..."
echo "📁 Loading environment from .env file..."

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    exit 1
fi

echo "✅ .env file found"

# Start the server without NODE_ENV override
npx tsx server/index.ts