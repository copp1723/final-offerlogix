import { build } from 'esbuild';

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  packages: 'external',
  external: [
    'pg',
    'drizzle-orm',
    'express',
    'ws',
    'supermemory',
    'mailgun.js',
    'twilio',
    'openai'
  ]
}).catch(() => process.exit(1));