import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    testTimeout: 20000,
    hookTimeout: 60000,
    setupFiles: ['tests/setup.ts'],
    fileParallelism: false,
    env: { NODE_ENV: 'test' },
  },
});
