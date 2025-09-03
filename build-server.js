import { build } from 'esbuild';
import { nodeExternalsPlugin } from 'esbuild-node-externals';

async function buildServer() {
  try {
    await build({
      entryPoints: ['server/index.ts'],
      bundle: true,
      platform: 'node',
      target: 'node20',
      outfile: 'dist/server.js',
      format: 'esm',
      sourcemap: true,
      minify: false,
      plugins: [nodeExternalsPlugin()],
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