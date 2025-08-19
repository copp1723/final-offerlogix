import { build } from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outdir: 'dist',
  packages: 'external',
  alias: {
    '@shared': path.resolve(__dirname, 'shared'),
  },
  external: [
    'pg',
    'drizzle-orm',
    'express',
    'express-session',
    'connect-pg-simple',
    'ws',
    'supermemory',
    'mailgun.js',
    'twilio',
    'openai',
    'dotenv',
    'csv-parse',
    'multer',
    'zod',
    'drizzle-zod',
    'imap-simple',
    'mailparser',
    'tiktoken',
    'memoizee',
    'form-data',
    'zod-validation-error',
    'date-fns',
    'forwarded'
  ]
}).catch(() => process.exit(1));