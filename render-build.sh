#!/bin/bash
# Render build script for OfferLogix

echo "Installing all dependencies including devDependencies..."
npm ci --include=dev

echo "Building the application..."
npm run build:render

echo "Build complete!"