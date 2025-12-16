// jest.config.js
const nextJest = require('next/jest');

// Providing the path to your Next.js app which will enable loading next.config.js and .env files
const createJestConfig = nextJest({ dir: './' });

const commonJestConfig = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@platform/(.*)$': '<rootDir>/src/platform/$1',
  },
  // Exclude e2e tests from Jest runs
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    // excluded, because it just provides a common TokenManager for tests but no own tests
    'src/platform/integrations/emporix/common/impl/EmporixTokenManager.test.ts',
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
      testMatch: ['**/hooks/**/?(*.)+(spec|test).ts?(x)'],
      setupFilesAfterEnv: ['<rootDir>/jest.react.setup.js'],
      transform: {
        '^.+\\.(ts|tsx)$': [
          '@swc/jest',
          {
            jsc: {
              transform: {
                react: {
                  runtime: 'automatic',
                },
              },
            },
          },
        ],
      },
      ...commonJestConfig,
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
      testMatch: ['**/lib/**/?(*.)+(spec|test).ts?(x)'],
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
