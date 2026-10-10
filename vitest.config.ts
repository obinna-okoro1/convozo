import { fileURLToPath } from 'node:url';

import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [angular({ tsconfig: 'src/tsconfig.spec.json' })],
  resolve: {
    alias: {
      'app/': `${root}src/app/`,
      'environments/': `${root}src/environments/`,
      '@testing/': `${root}testing/`,
    },
  },
  test: {
    clearMocks: true,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.spec.ts', 'eslint-local-rules/**/*.spec.ts'],
    maxWorkers: process.env.VITEST_MAX_WORKERS,
    reporters: ['default', 'junit'],
    outputFile: { junit: 'coverage/junit.xml' },
  },
});
