// jest.config.js
const fs = require('fs');
const nextJest = require('next/jest');
const path = require('path');
const dotenv = require('dotenv');

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: './' });

const isCi = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

/** Prefer `DOTENV_CONFIG_PATH`, then `.env.test`, then `.env` (no values hardcoded here). */
function resolveJestDotenvPath() {
  if (process.env.DOTENV_CONFIG_PATH) {
    const raw = process.env.DOTENV_CONFIG_PATH;
    return path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
  }
  const testEnv = path.resolve(__dirname, '.env.test');
  const defaultEnv = path.resolve(__dirname, '.env');
  if (fs.existsSync(testEnv)) return testEnv;
  if (fs.existsSync(defaultEnv)) return defaultEnv;
  return testEnv;
}

const envPath = resolveJestDotenvPath();

if (!isCi || process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: envPath, quiet: true });
}

// Tier 1 (same rules as `next.config.ts`): fail fast if required env vars are missing.
// Values must come from `.env.test`, `DOTENV_CONFIG_PATH`, or CI-injected `process.env` — no literals here.
(function assertJestRequiredEnv() {
  require('ts-node').register({
    project: path.resolve(__dirname, 'scripts/tsconfig.json'),
    transpileOnly: true,
  });
  const { validateEnvVars } = require('./src/platform/healthcheck/env-validation.ts');
  const envResult = validateEnvVars();
  if (envResult.hasErrors) {
    const missing = envResult.items
      .filter((i) => !i.passed && i.severity === 'error')
      .map((i) => `  ✗ ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console -- Jest bootstrap runs before application LoggerService exists
    console.error(`\n[jest] Missing required environment variables (same Tier-1 set as next build):\n${missing}\n`);
    throw new Error(
      'Missing required env values for Jest. Use a complete env file (e.g. `.env.test` or `.env`), set DOTENV_CONFIG_PATH, or export the same Tier-1 variables as `next.config.ts` / validateEnvVars in CI.',
    );
  }
})();

(function sanitizeProcessNodeOptions() {
  const raw = process.env.NODE_OPTIONS;
  if (!raw) return;
  const filtered = raw
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !p.startsWith('--localstorage-file') && !p.startsWith('--experimental-webstorage'));
  if (filtered.length === 0) {
    delete process.env.NODE_OPTIONS;
  } else {
    process.env.NODE_OPTIONS = filtered.join(' ');
  }
})();

const hasEmporixTestConfig = Boolean(
  process.env.NEXT_EMPORIX_TEST_TENANT &&
    process.env.NEXT_EMPORIX_TEST_CLIENT_ID &&
    process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET,
);
const hasBatteryIncludedConfig = Boolean(
  process.env.NEXT_PUBLIC_BATTERY_INCLUDED_API_KEY && process.env.NEXT_PUBLIC_BATTERY_INCLUDED_COLLECTION,
);
const runIntegrationTests = isCi || process.env.RUN_INTEGRATION_TESTS === 'true';
const skipEmporixIntegrationTests = !runIntegrationTests || !hasEmporixTestConfig;
const skipBatteryIncludedTests = !runIntegrationTests || !hasBatteryIncludedConfig;

console.log('[jest] RUN_INTEGRATION_TESTS:', process.env.RUN_INTEGRATION_TESTS);
console.log('[jest] Emporix config present:', hasEmporixTestConfig);
console.log('[jest] BatteryIncluded config present:', hasBatteryIncludedConfig);
if (!isCi) {
  console.log('[jest] env file source:', envPath);
}

const integrationTestIgnorePatterns = [
  ...(skipEmporixIntegrationTests ? ['src/platform/integrations/emporix/.*/impl/.*\\.test\\.(ts|tsx)$'] : []),
  ...(skipBatteryIncludedTests ? ['src/platform/integrations/batteryincluded/.*/impl/.*\\.test\\.(ts|tsx)$'] : []),
];

const commonJestConfig = {
  // Note: nextJest automatically creates moduleNameMapper from tsconfig.json paths
  // We explicitly set it here to ensure it's applied to all projects
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@platform/(.*)$': '<rootDir>/src/platform/$1',
    '^server-only$': '<rootDir>/jest/mocks/server-only.js',
  },
  // Exclude e2e tests from Jest runs
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    // excluded, because it just provides a common TokenManager for tests but no own tests
    'src/platform/integrations/emporix/common/impl/EmporixTokenManager.test.ts',
    ...integrationTestIgnorePatterns,
  ],
};
// Any custom config you want to pass to Jest
const customJestConfig = {
  preset: 'ts-jest',

  projects: [
    {
      preset: 'ts-jest',
      displayName: 'React Tests',
      testEnvironment: 'jsdom',
      testMatch: [
        '**/hooks/**/?(*.)+(spec|test).ts?(x)',
        '**/providers/**/?(*.)+(spec|test).ts?(x)',
        '**/components/checkout/checkout-validation-registry*.test.ts?(x)',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.react.setup.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@platform/(.*)$': '<rootDir>/src/platform/$1',
        '^server-only$': '<rootDir>/jest/mocks/server-only.js',
      },
      testPathIgnorePatterns: commonJestConfig.testPathIgnorePatterns,
      transformIgnorePatterns: ['/node_modules/(?!(next-intl|use-intl)/)'],
      transform: {
        '^.+\\.(ts|tsx)$': [
          '@swc/jest',
          {
            jsc: {
              parser: {
                syntax: 'typescript',
                decorators: true, // TypeScript decorators required, lack was causing a syntax error when parsing files with @injectable decorators
                tsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
                legacyDecorator: true,
                decoratorMetadata: true,
              },
              target: 'es2017',
            },
            module: {
              type: 'es6',
            },
          },
        ],
        '^.+\\.(js|jsx)$': [
          '@swc/jest',
          {
            jsc: {
              parser: {
                syntax: 'ecmascript',
                jsx: true,
              },
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
              target: 'es2017',
            },
            module: {
              type: 'es6',
            },
          },
        ],
      },
    },
    {
      preset: 'ts-jest',
      displayName: 'Component Tests',
      testEnvironment: 'node',
      testMatch: ['**/components/**/?(*.)+(spec|test).ts?(x)'],
      setupFilesAfterEnv: ['<rootDir>/jest.platform.setup.js'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: 'tsconfig.json',
          },
        ],
      },
      ...commonJestConfig,
      testPathIgnorePatterns: [
        ...commonJestConfig.testPathIgnorePatterns,
        'src/components/checkout/checkout-validation-registry.*\\.test\\.(ts|tsx)$',
      ],
    },
    {
      preset: 'ts-jest',
      displayName: 'Platform Tests',
      testEnvironment: 'node',
      testMatch: ['**/platform/**/?(*.)+(spec|test).ts?(x)'],
      setupFilesAfterEnv: ['<rootDir>/jest.platform.setup.js'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: 'tsconfig.json',
          },
        ],
      },
      ...commonJestConfig,
    },
    {
      preset: 'ts-jest',
      displayName: 'Library Tests',
      testEnvironment: 'node',
      testMatch: [
        '**/lib/**/?(*.)+(spec|test).ts?(x)',
        '**/stores/**/?(*.)+(spec|test).ts?(x)',
        '**/app/api/**/?(*.)+(spec|test).ts?(x)',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.platform.setup.js'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: 'tsconfig.json',
          },
        ],
      },
      ...commonJestConfig,
    },
  ],
};

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async
module.exports = createJestConfig(customJestConfig);
