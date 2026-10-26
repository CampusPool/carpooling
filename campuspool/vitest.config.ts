import { defineConfig } from 'vitest/config';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  resolve:{alias:{'@':fileURLToPath(new URL('./src',import.meta.url))}},
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: Number(process.env.CP_TEST_TIMEOUT ?? 30_000),
    hookTimeout: Number(process.env.CP_HOOK_TIMEOUT ?? 30_000),
    reporters: ['default'],
  },
});

