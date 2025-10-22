import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'scripts/**',
      'next-env.d.ts',
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/*.config.*s',
      '**/*.setup.js',
      '**/*.d.ts',
    ],
  },
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript', 'prettier'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // we are more lax about any-types, especially in regards to Mixins
      '@typescript-eslint/no-empty-object-type': 'off', //  Empty Object Types are necessary for specific Mapper<T,K> declarations
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }, // excluding unused variables which are prefixed with _ is common practice
      ],
      '@typescript-eslint/no-unsafe-function-type': 'off',
    },
  }),
];

export default eslintConfig;
