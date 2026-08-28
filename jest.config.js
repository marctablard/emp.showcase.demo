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
const runIntegrationTests = isCi || process.env.RUN_INTEGRATION_TESTS === 'true';
const skipEmporixIntegrationTests = !runIntegrationTests || !hasEmporixTestConfig;

console.log('[jest] RUN_INTEGRATION_TESTS:', process.env.RUN_INTEGRATION_TESTS);
console.log('[jest] Emporix config present:', hasEmporixTestConfig);
if (!isCi) {
  console.log('[jest] env file source:', envPath);
}

const integrationTestIgnorePatterns = [
  ...(skipEmporixIntegrationTests ? ['src/platform/integrations/emporix/.*/impl/.*\\.test\\.(ts|tsx)$'] : []),
];

const commonJestConfig = {
  // Note: nextJest automatically creates moduleNameMapper from tsconfig.json paths
  // We explicitly set it here to ensure it's applied to all projects.
  //
  // `next-auth/react` is mocked narrowly inside the `React Tests` project
  // only — see jest/mocks/README.md for the rationale. Platform / Library
  // tests resolve it to the real module path.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@platform/(.*)$': '<rootDir>/src/platform/$1',
    '^server-only$': '<rootDir>/jest/mocks/server-only.ts',
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
        '**/components/cms/**/?(*.)+(spec|test).ts?(x)',
        '**/components/theme/**/?(*.)+(spec|test).ts?(x)',
        // App-router layout/page tests that render `<html>`/`<body>` + the
        // client provider stack need RTL + jsdom. The preview-route layout
        // (EMP-22) is the first such test; without this entry it matches no
        // project and becomes a silent skip (see `test_orphaned-tests`).
        '**/app/preview/**/?(*.)+(spec|test).ts?(x)',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.react.setup.js'],
      moduleNameMapper: {
        // CMS-component tests do not exercise full ProductTile rendering —
        // stub these heavy children so the carousel/recommendations trees
        // can hydrate without dragging the full Zustand provider stack into
        // every test setup. The platform-side mapper entry below (`^@/...$`)
        // must remain the *last* fallback so these specific paths win.
        '^@/components/product/product-tile$': '<rootDir>/jest/mocks/product-tile.ts',
        '^@/components/product/product-tile-skeleton$': '<rootDir>/jest/mocks/product-tile-skeleton.ts',
        // Stylesheet imports (e.g. `import '@/app/globals.css'`) must resolve to an
        // inert module — this project overrides next/jest's CSS handling. Keep this
        // BEFORE the `^@/(.*)$` fallback so `.css` never feeds the TS transform.
        '\\.(css|scss|sass)$': '<rootDir>/jest/mocks/style-mock.js',
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@platform/(.*)$': '<rootDir>/src/platform/$1',
        '^server-only$': '<rootDir>/jest/mocks/server-only.ts',
        '^next-auth/react$': '<rootDir>/jest/mocks/next-auth-react.ts',
      },
      testPathIgnorePatterns: commonJestConfig.testPathIgnorePatterns,
      transformIgnorePatterns: [
        '/node_modules/(?!(next-intl|use-intl|@formatjs|intl-messageformat|icu-minify|icu-messageformat-parser|icu-skeleton-parser|intl-localematcher|@schummar/icu-type-parser)/)',
      ],
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
      transformIgnorePatterns: [
        '/node_modules/(?!(next-intl|use-intl|@formatjs|intl-messageformat|icu-minify|icu-messageformat-parser|icu-skeleton-parser|intl-localematcher|@schummar/icu-type-parser)/)',
      ],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: 'tsconfig.json',
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
      ...commonJestConfig,
      testPathIgnorePatterns: [
        ...commonJestConfig.testPathIgnorePatterns,
        'src/components/checkout/checkout-validation-registry.*\\.test\\.(ts|tsx)$',
        // CMS component tests need RTL/jsdom; routed to the React Tests project.
        String.raw`src/components/cms/.*\.test\.(ts|tsx)$`,
        // Theme component tests need RTL/jsdom; routed to the React Tests project.
        String.raw`src/components/theme/.*\.test\.(ts|tsx)$`,
      ],
    },
    {
      preset: 'ts-jest',
      displayName: 'Platform Tests',
      testEnvironment: 'node',
      testMatch: ['**/platform/**/?(*.)+(spec|test).ts?(x)'],
      setupFilesAfterEnv: ['<rootDir>/jest.platform.setup.js'],
      transformIgnorePatterns: [
        '/node_modules/(?!(next-intl|use-intl|@formatjs|intl-messageformat|icu-minify|icu-messageformat-parser|icu-skeleton-parser|intl-localematcher|@schummar/icu-type-parser)/)',
      ],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: 'tsconfig.json',
          },
        ],
        // Platform tests that import the Storyblok adapter chain reach the
        // shared CMS render layer (e.g. `StoryblokCmsMapper` → the agnostic
        // `CMSPage` components, see ADR 0001) and transitively the pure-ESM
        // `next-intl` (via `@/i18n/navigation`). ts-jest only transforms
        // `.tsx?`; the ESM `.js` / `.jsx` / `.mjs` from `next-intl`,
        // `use-intl` and the `@formatjs` / `icu-*` chain needs an explicit
        // transform here so those platform tests can load it.
        '^.+\\.(js|jsx|mjs)$': [
          '@swc/jest',
          {
            jsc: {
              parser: { syntax: 'ecmascript', jsx: true },
              transform: { react: { runtime: 'automatic' } },
              target: 'es2017',
            },
            module: { type: 'commonjs' },
          },
        ],
      },
      ...commonJestConfig,
      // `commonJestConfig` carries no `transformIgnorePatterns`, so the
      // project-level entry above stays in effect — do not re-declare a
      // narrower list here, it would silently win over it.
      testPathIgnorePatterns: [...commonJestConfig.testPathIgnorePatterns],
    },
    {
      preset: 'ts-jest',
      displayName: 'Library Tests',
      testEnvironment: 'node',
      testMatch: [
        // Server bootstrap hook lives at the src/ root (Next.js fixes its
        // location), so it matches none of the directory-scoped patterns
        // above. Pin it explicitly here — node env + tsconfig transform fit a
        // server-only boot test — so it can never become a silent skip.
        '**/src/instrumentation.test.ts',
        '**/lib/**/?(*.)+(spec|test).ts?(x)',
        '**/stores/**/?(*.)+(spec|test).ts?(x)',
        '**/app/api/**/?(*.)+(spec|test).ts?(x)',
        // Cache rule tests (`src/caching/**`) — node env; without this entry
        // they match no project and become a silent skip (see `test_orphaned-tests`).
        '**/caching/**/?(*.)+(spec|test).ts?(x)',
        // Filter/signature helpers (`src/utils/**`) — node env; without this
        // entry they match no project and become a silent skip (see `test_orphaned-tests`).
        '**/utils/**/?(*.)+(spec|test).ts?(x)',
        '**/scripts/**/?(*.)+(spec|test).ts?(x)',
        // Per-site theme registry (`src/app/styles/themes`) — pure resolver
        // logic, no DOM; node project keeps it from being a silent skip.
        '**/app/styles/**/?(*.)+(spec|test).ts?(x)',
        // Server-action modules under `src/app/_actions/` are server-only
        // (`'use server'` + `'server-only'`). Their tests fit the Library
        // project's node env + tsconfig transform; without this entry they
        // match no project and become a silent skip (see `test_orphaned-tests`).
        '**/app/_actions/**/?(*.)+(spec|test).ts?(x)',
      ],
      setupFilesAfterEnv: ['<rootDir>/jest.platform.setup.js'],
      transformIgnorePatterns: [
        '/node_modules/(?!(next-intl|use-intl|@formatjs|intl-messageformat|icu-minify|icu-messageformat-parser|icu-skeleton-parser|intl-localematcher|@schummar/icu-type-parser)/)',
      ],
      transform: {
        '^.+\\.(ts|tsx)$': [
          '@swc/jest',
          {
            jsc: {
              parser: {
                syntax: 'typescript',
                decorators: true,
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
      ...commonJestConfig,
    },
  ],
};

// createJestConfig is exported in this way to ensure that next/jest can load the Next.js configuration, which is async
module.exports = createJestConfig(customJestConfig);
