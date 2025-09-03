const esbuild = require('esbuild');

async function buildServer() {
  try {
    await esbuild.build({
      entryPoints: ['server/index.ts'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/server.js',
      format: 'cjs',
      sourcemap: true,
      minify: false,
      external: [
        // Node built-ins
        'fs', 'path', 'crypto', 'os', 'stream', 'util', 'http', 'https', 'net', 'tls', 'dns', 'events', 'child_process', 'worker_threads', 'perf_hooks',
        // Dependencies that should not be bundled
        'express', 'pg', 'postgres', 'drizzle-orm', 'bcrypt', 'jsonwebtoken', 'winston', 'mailgun.js', 'bull', 'ioredis',
        'dotenv', 'helmet', 'morgan', 'multer', 'passport', 'express-session', 'express-rate-limit', 'connect-pg-simple',
        '@neondatabase/serverless', 'ws', 'jsdom', 'mailparser', 'imap-simple', 'node-cron', 'openai', 'tiktoken', 'supermemory'
      ],
      loader: {
        '.ts': 'ts',
        '.tsx': 'tsx'
      }
    });
    console.log('Server build complete!');
  } catch (error) {
    console.error('Server build failed:', error);
    process.exit(1);
  }
}

buildServer();