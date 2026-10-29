import { defineConfig } from '@playwright/test';
import { config } from 'dotenv';
config({ quiet: true });
const testUrl = process.env.TEST_DATABASE_URL;
const testDirectUrl = process.env.TEST_DATABASE_URL_UNPOOLED;
if (!testUrl || !testDirectUrl)
  throw new Error(
    'E2E exige TEST_DATABASE_URL e TEST_DATABASE_URL_UNPOOLED de uma branch Neon exclusiva',
  );
const endpoint = (url: string) => {
  const parsed = new URL(url);
  return parsed.hostname.replace('-pooler', '') + parsed.pathname;
};
if (
  process.env.DATABASE_URL &&
  [testUrl, testDirectUrl].some((url) => endpoint(url) === endpoint(process.env.DATABASE_URL!))
)
  throw new Error('E2E não pode usar o banco da aplicação');
if (endpoint(testUrl) !== endpoint(testDirectUrl))
  throw new Error('As duas URLs de teste devem apontar para o mesmo banco Neon');
const apiEnv = {
  DATABASE_URL: testUrl,
  DATABASE_URL_UNPOOLED: testDirectUrl,
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
