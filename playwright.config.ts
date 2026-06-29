import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const includeLocalSpecs = process.env.NEXT_E2E_LOCAL_AUTH_BOOTSTRAP_ENABLED === 'true';
const localOnlyPort = process.env.PLAYWRIGHT_LOCAL_PORT || '3100';
const playwrightPort = includeLocalSpecs ? localOnlyPort : '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${playwrightPort}`;
const webServerCommand = includeLocalSpecs
  ? `npm run build:next && npx next start --port ${playwrightPort}`
  : 'npm run dev';

/** Strip broken Node flags that trigger stderr noise in dev subprocesses (e.g. empty `--localstorage-file`). */
function sanitizedNodeOptionsPatch(): Record<string, string> | undefined {
  const raw = process.env.NODE_OPTIONS;
  if (!raw) return undefined;
  const filtered = raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !p.startsWith('--localstorage-file') && !p.startsWith('--experimental-webstorage'));
  return { NODE_OPTIONS: filtered.join(' ') };
}

function stringEnvOnly(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) {
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: ['**/local/**', ...(includeLocalSpecs ? [] : ['**/*.local.spec.ts'])],
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: webServerCommand,
    /** Use liveness endpoint so readiness polling does not hit `/` (site middleware health-check shortcut). */
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI && !includeLocalSpecs,
    timeout: 120 * 1000, // 2 minutes to allow for Next.js to build
    env: {
      ...stringEnvOnly(process.env),
      PORT: playwrightPort,
      NEXTAUTH_URL: baseURL,
      NEXT_PUBLIC_SERVER_URL: baseURL,
      ...(sanitizedNodeOptionsPatch() ?? {}),
    },
  },
});
