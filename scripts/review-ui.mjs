import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { config } from 'dotenv';
config({ quiet: true });
const browser = await chromium.launch();
await mkdir('docs/screenshots', { recursive: true });
try {
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    const failed = new Set();
    page.on('requestfailed', (r) => {
      if (r.url().includes('tile.openstreetmap')) failed.add(r.failure()?.errorText);
    });
    await page.goto('http://localhost:3000/login');
    await page.getByLabel('E-mail', { exact: true }).fill('admin@vantrack.demo');
    await page.locator('input[name="password"]').fill(process.env.DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Entrar na minha conta' }).click();
    await page.getByRole('heading', { name: 'Visão geral' }).waitFor();
    await page.locator('.leaflet-container').waitFor();
    await page
      .waitForFunction(
        () => document.querySelectorAll('.leaflet-tile-loaded').length > 0,
        {},
        { timeout: 12000 },
      )
      .catch(() => undefined);
    await page
      .waitForFunction(
        () =>
          document.querySelectorAll('.leaflet-tile:not(.leaflet-tile-loaded)').length === 0 &&
          document.querySelectorAll('.leaflet-overlay-pane path').length > 0,
        {},
        { timeout: 12000 },
      )
      .catch(() => undefined);
    await page.screenshot({ path: `docs/screenshots/dashboard-${theme}.png`, fullPage: true });
    const ratios = await page.evaluate(() => {
      const style = getComputedStyle(document.documentElement),
        canvas = document.createElement('canvas'),
        ctx = canvas.getContext('2d');
      function color(name) {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = style.getPropertyValue(name).trim();
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data]
          .slice(0, 3)
          .map((x) => {
            x /= 255;
            return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
          })
          .reduce((a, x, i) => a + x * [0.2126, 0.7152, 0.0722][i], 0);
      }
      function ratio(a, b) {
        const x = color(a),
          y = color(b);
        return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
      }
      return {
        body: ratio('--ink', '--background'),
        muted: ratio('--muted', '--surface'),
        navigation: ratio('--link', '--primary-soft'),
        loadedTiles: document.querySelectorAll('.leaflet-tile-loaded').length,
      };
    });
    console.log(theme, JSON.stringify(ratios), 'tileFailures', failed.size);
    if (theme === 'light') {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: 'docs/screenshots/dashboard-mobile.png', fullPage: true });
    }
    await context.close();
  }
} finally {
  await browser.close();
}
