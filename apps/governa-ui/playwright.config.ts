// ============================================================
// playwright.config.ts
//
// Playwright E2E — governa-ui
//
// Assume que o governa-gateway está rodando em localhost:3001
// e o governa-ui em localhost:4200 (ng serve).
//
// Para CI: use GATEWAY_URL e UI_URL via env vars.
// ============================================================
import { defineConfig, devices } from '@playwright/test';

const UI_URL     = process.env['UI_URL']      ?? 'http://localhost:4200';
const GATEWAY_URL = process.env['GATEWAY_URL'] ?? 'http://localhost:3001';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: UI_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
