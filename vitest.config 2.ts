import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'server/**/*.test.ts',
      'server/**/__tests__/**/*.test.ts',
      'server/**/__tests__/**/*.spec.ts',
      'server/**/__tests__/**/*.ts',
    ],
    exclude: [
      '**/node_modules/**', '**/dist/**', '**/cypress/**', '**/.{idea,git,cache,output,temp}/**',
    ],
    environment: 'node',
  },
});

