import { defineConfig, devices } from '@playwright/test';

const env = (
  globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }
).process?.env;

const isCI = Boolean(env?.CI);
const baseURL = env?.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173';
const webServerCommand = env?.PLAYWRIGHT_WEB_SERVER_CMD ?? 'npm run preview:e2e';
const skipWebServer = env?.PLAYWRIGHT_SKIP_WEBSERVER === '1';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: webServerCommand,
        url: baseURL,
        reuseExistingServer: !isCI,
      },
  projects: [
    {
      name: 'chromium',
      testIgnore: [
        /.*\.a11y\.spec\.ts/,
        /.*webkit-smoke\.spec\.ts/,
        /.*webkit-release-smoke\.spec\.ts/,
      ],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-a11y',
      testMatch: /.*\.a11y\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        serviceWorkers: 'block',
      },
    },
    {
      name: 'webkit',
      testMatch: /.*webkit-smoke\.spec\.ts/,
      retries: 2,
      workers: 1,
      use: {
        ...devices['Desktop Safari'],
      },
    },
    {
      name: 'webkit-release',
      testMatch: /.*webkit-release-smoke\.spec\.ts/,
      retries: 2,
      workers: 1,
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
});
