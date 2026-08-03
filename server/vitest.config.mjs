import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    // Each file gets its own in-memory MongoDB, and several exercise
    // ownership/cascade behaviour against shared collections — running them
    // in parallel would have them clobbering each other's fixtures.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
