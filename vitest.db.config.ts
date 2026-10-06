import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Database tests run against a disposable PostgreSQL database: `npm run test:db`.
// They are not part of `npx vitest run`, which needs no database.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'src/db-tests/server-only-stub.ts'),
    },
  },
  test: {
    include: ['src/db-tests/**/*.dbtest.ts'],
    globalSetup: ['src/db-tests/global-setup.ts'],
    setupFiles: ['src/db-tests/setup-env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
