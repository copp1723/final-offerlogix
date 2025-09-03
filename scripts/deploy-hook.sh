#!/bin/bash
# Simple deployment hook to sync database schema
# Run this after deploy to automatically update database

echo "🚀 Running post-deploy database sync..."
psql "$DATABASE_URL" -f scripts/fix-db.sql
echo "✅ Database sync complete!"