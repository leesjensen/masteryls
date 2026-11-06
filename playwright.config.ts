import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['html', { open: 'never' }]],
  timeout: 20000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  expect: {
    timeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 800, height: 600 },
        contextOptions: {
          ...(process.env.COVERAGE && {
            // This helps with coverage collection
            ignoreHTTPSErrors: true,
          }),
        },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: process.env.COVERAGE ? 'COVERAGE=true npm run dev' : 'npm run dev',
    url: 'http://localhost:5173',
    // Redirect the app's `config` import to tests/fixtures/config.js (see vite.config.js) so e2e
    // runs against a deterministic config (observability off) regardless of the ambient config.js.
    env: { MLS_TEST_CONFIG: '1' },
    reuseExistingServer: !process.env.CI,
    timeout: 20000,
  },
});
