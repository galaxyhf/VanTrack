import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
const dbDir = resolve('.data/e2e');
const apiEnv = {
  DATABASE_MODE: 'embedded',
  DATABASE_DATA_DIR: dbDir,
  WEB_ORIGIN: 'http://localhost:3100',
  PORT: '4100',
  NODE_ENV: 'test',
  SIMULATOR_ENABLED: 'true',
  SEED_DEMO: 'true',
  DEMO_PASSWORD: 'VanTrack-Dev-2026!',
};
export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  webServer: [
    {
      command: 'pnpm db:migrate && pnpm db:seed && pnpm --filter @vantrack/api dev',
      url: 'http://localhost:4100/health',
      env: apiEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
    {
      command: 'pnpm --filter @vantrack/web dev --port 3100',
      url: 'http://localhost:3100',
      env: { NEXT_DIST_DIR: '.next-e2e', NEXT_PUBLIC_API_URL: 'http://localhost:4100' },
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
    },
  ],
});
