# Render Build Command for OneKeel Swarm

## Use This Exact Build Command in Render:

```bash
npm ci && vite build --config vite.config.render.ts && esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist
```

## Why This Command:
1. **`npm ci`** - Clean dependency install
2. **`vite build --config vite.config.render.ts`** - Uses production config without Replit plugins
3. **`esbuild server/index.ts`** - Builds the Node.js server
4. **`--outdir=dist`** - Outputs to dist directory

## Start Command:
```bash
npm start
```

## Pre-Deploy Command (Optional):
```bash
npm run db:push
```

This ensures the database schema is updated before starting the application.

## Environment Variables Required:
- `DATABASE_URL` (from Render PostgreSQL)
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN=mg.watchdogai.us`
- `SESSION_SECRET`

## Health Check Path:
```
/api/health/system
```

Copy the build command exactly as shown above into your Render service configuration.