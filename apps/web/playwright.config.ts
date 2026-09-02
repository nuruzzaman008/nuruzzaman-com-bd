import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite runs against a production build. `E2E_BASE_URL` points it at a
 * running stack (Docker compose, or staging); without it, Playwright starts the
 * mock API and `next start` itself so the critical journeys can be smoke-tested
 * without the PHP stack.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3100';
const useExternalStack = Boolean(process.env.E2E_BASE_URL);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL,
    trace: 'on-first-retry',
    locale: 'bn-BD',
    timezoneId: 'Asia/Dhaka',
  },

  /*
   * All three projects run on Chromium so the suite needs a single browser
   * download. Swapping a project to `devices['iPad (gen 7)']` (WebKit) or
   * adding a Firefox project is a one-line change once those engines are
   * installed with `npx playwright install`.
   */
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],

  webServer: useExternalStack
    ? undefined
    : [
        {
          command: 'node tools/mock-api.mjs 8101',
          url: 'http://127.0.0.1:8101/api/v1/site/settings',
          reuseExistingServer: !process.env.CI,
        },
        {
          command: 'next build && next start --port 3100',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 240_000,
          env: {
            INTERNAL_API_URL: 'http://127.0.0.1:8101/api/v1',
            NEXT_PUBLIC_SITE_URL: baseURL,
            NEXT_REVALIDATE_SECRET: 'e2e-secret',
          },
        },
      ],
});
