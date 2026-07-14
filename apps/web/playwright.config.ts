import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Boot the app for the tests; reuse a running dev server locally.
  webServer: {
    command: `pnpm dev -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // Next's cold start is slow on WSL/Windows-mounted filesystems.
    timeout: 240_000,
  },
});
