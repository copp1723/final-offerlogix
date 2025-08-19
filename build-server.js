import { build } from 'esbuild';

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  external: ['*'],
  packages: 'external'
}).catch(() => process.exit(1));