import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/test/global-setup.ts'],
    // Integration tests share one test database; run files one at a time.
    fileParallelism: false,
  },
});
