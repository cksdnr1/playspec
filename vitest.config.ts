import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '#core': path.resolve(__dirname, 'src/core'),
      '#storage': path.resolve(__dirname, 'src/storage'),
      '#workflow': path.resolve(__dirname, 'src/workflow'),
      '#template': path.resolve(__dirname, 'src/template'),
      '#preset': path.resolve(__dirname, 'src/preset'),
      '#utils': path.resolve(__dirname, 'src/utils'),
      '#mcp': path.resolve(__dirname, 'src/mcp'),
      '#migration': path.resolve(__dirname, 'src/migration'),
      '#pack': path.resolve(__dirname, 'src/pack'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
    testTimeout: 30_000,
  },
});
