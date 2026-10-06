import { defineConfig } from 'vitest/config';

// Database tests run against a disposable PostgreSQL database: `npm run test:db`.
// They are not part of `npx vitest run`, which needs no database.
export default defineConfig({
  test: {
    include: ['src/db-tests/**/*.dbtest.ts'],
    globalSetup: ['src/db-tests/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
