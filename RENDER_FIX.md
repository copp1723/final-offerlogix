# Render Deployment Fix - Replit Dependencies Issue

## Problem
The deployment failed because vite.config.ts imports Replit-specific plugins:
- `@replit/vite-plugin-cartographer`
- `@replit/vite-plugin-runtime-error-modal`

These packages don't exist on Render and cause build failures.

## Solution Applied

### 1. Created Production Vite Config
- `vite.config.render.ts` - Clean config without Replit dependencies
- Uses only standard Vite plugins (React)
- Maintains all path aliases and build settings

### 2. Updated Build Process
- `render.yaml` now uses `npm run build:render` command
- `build.sh` uses the production vite config directly
- Avoids Replit-specific dependencies during build

### 3. Build Command for Render
```bash
vite build --config vite.config.render.ts && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

## Manual Deployment Steps

If using the Blueprint doesn't work, deploy manually:

1. **Fork the repository**
2. **In Render Dashboard:**
   - New Web Service
   - Connect GitHub repo
   - Build Command: `npm ci && vite build --config vite.config.render.ts && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`
   - Start Command: `npm start`

3. **Create PostgreSQL database separately**
4. **Set environment variables**

## What Was Fixed
- ✅ Removed Replit plugin dependencies from build
- ✅ Created production-safe vite configuration
- ✅ Updated all deployment documentation
- ✅ Provided manual deployment fallback

The platform will now deploy successfully on Render without Replit-specific dependencies.