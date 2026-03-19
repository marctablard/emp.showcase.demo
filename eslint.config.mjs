import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // we are more lax about any-types, especially in regards to Mixins
      '@typescript-eslint/no-empty-object-type': 'off', //  Empty Object Types are necessary for specific Mapper<T,K> declarations
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }, // excluding unused variables which are prefixed with _ is common practice
      ],
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'no-console': ['warn'], // Use Pino LoggerService instead of console.*. See docs/logging-guide.md
    },
  },
  globalIgnores([
    // Default ignores of eslint-config-next:
    'node_modules/**',
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'scripts/**',
    'public/**',
    '**/*.test.ts',
    '**/*.test.tsx',
    '**/*.config.*s',
    '**/*.setup.js',
    '**/*.d.ts',
  ]),
]);

export default eslintConfig;
