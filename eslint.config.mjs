import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

function isNextPublicClientDiGenerationEnabled() {
  const raw = (process.env.NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT ?? '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

const restrictPlatformClientImport = !isNextPublicClientDiGenerationEnabled();

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', fixStyle: 'separate-type-imports' }],
      '@typescript-eslint/no-explicit-any': 'off', // we are more lax about any-types, especially in regards to Mixins
      '@typescript-eslint/no-empty-object-type': 'off', //  Empty Object Types are necessary for specific Mapper<T,K> declarations
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }, // excluding unused variables which are prefixed with _ is common practice
      ],
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'no-console': ['warn'], // Use Pino LoggerService instead of console.*. See docs/logging-guide.md
      'no-restricted-imports': [
        'error',
        {
          paths: [
            ...(restrictPlatformClientImport
              ? [
                  {
                    name: '@/platform/client',
                    message:
                      'Client Inversify container is off by default. Use @/lib/logger/browser-logger and @/lib/client/validation-registry, or set NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT=true, run npm run generate, and import the generated client container.',
                  },
                ]
              : []),
            {
              name: '@/lib/client/service',
              message: 'Removed. Use @/lib/logger/browser-logger or @/lib/client/validation-registry.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'scripts/**',
    'specifications/**',
    'public/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.config.*s',
    '**/*.setup.js',
    '**/*.d.ts',
  ]),
]);

export default eslintConfig;
